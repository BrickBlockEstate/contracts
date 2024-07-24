// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AutomationCompatibleInterface} from "@chainlink/contracts/src/v0.8/automation/interfaces/AutomationCompatibleInterface.sol";
import "hardhat/console.sol";

contract NormalRental is ERC1155, Ownable, AutomationCompatibleInterface {
    error NormalRental__TRANSFER_FAILED_submitRent();
    error NormalRental__TRANSFER_FAILED_mint();
    error NormalRental__TRANSFER_FAILED_distributeRent();
    error NormalRental__TRANSFER_FAILED_mintOffplanInstalments();
    error NormalRental__ALREADY_HAVE_INSTALLMENTS_REMAINING();
    error NormalRental__NOT_IN_INSTALLMENTS();
    error NormalRental__NO_INSTALLMENTS_REMAINING();
    error NormalRental__TRANSFER_FAILED_payInstallments();

    using SafeERC20 for IERC20;

    IERC20 private immutable i_usdt;

    struct Property {
        uint256 id;
        uint256 price;
        address owner;
        uint256 amountMinted;
        uint256 amountGenerated;
        uint256 timestamp;
        bool isOffplan;
    }

    struct OffplanInvestor {
        address investor;
        uint256 remainingInstalmentsAmount;
        uint256 lastTimestamp;
    }

    string private constant BASE_EXTENSION = ".json";
    uint256 private s_currentTokenID;
    uint256[] private s_tokenIdsNormal;
    uint256[] private s_tokenIdsOffplan;
    bool public paused = false;
    uint256 public constant MAX_MINT_PER_PROPERTY = 100;
    uint256 public constant DECIMALS = 10 ** 6;
    uint256 private immutable i_upkeepInterval;

    mapping(uint256 => string) private s_tokenIdToTokenURIs;
    mapping(uint256 => Property) private s_tokenIdToProperties;
    mapping(uint256 => uint256) private s_tokenIdToRentGenerated;
    mapping(address => mapping(uint256 => uint256))
        private s_userToTokenIdToShares;
    mapping(uint256 => address[]) private s_tokenIdToInvestors;
    mapping(uint256 => Property) private s_tokenIdToOffplanProperties;
    mapping(uint256 => string) private s_offplanTokenIdToURIs;
    mapping(uint256 => OffplanInvestor[]) private s_tokenIdToInstallments;

    event PropertyMinted(uint256 indexed tokenId_);
    event OffplanPropertyMinted(uint256 indexed tokenId_);

    constructor(
        address _usdtAddress,
        uint256 _upkeepInterval
    ) ERC1155("") Ownable(msg.sender) {
        i_usdt = IERC20(_usdtAddress);
        s_currentTokenID = 0;
        i_upkeepInterval = _upkeepInterval;
    }

    function addProperty(
        string memory _uri,
        uint256 _price,
        uint256 _seed,
        bool _isOffPlan
    ) external onlyOwner {
        require(_isValidUri(_uri), "Please place a valid URI");
        require(_price > 0 && _seed > 0, "Please enter appropriate values");

        uint256 newTokenID = uniqueId(_seed, msg.sender);
        s_currentTokenID = newTokenID;
        uint256 priceDecimals = _price * DECIMALS;
        s_tokenIdToProperties[newTokenID] = Property({
            id: newTokenID,
            price: priceDecimals,
            owner: msg.sender,
            amountMinted: 0, //Shares in %
            amountGenerated: 0, // amount in usdt
            timestamp: block.timestamp,
            isOffplan: _isOffPlan
        });
        if (_isOffPlan) {
            s_tokenIdsOffplan.push(newTokenID);
            s_offplanTokenIdToURIs[newTokenID] = _uri;
            emit OffplanPropertyMinted(newTokenID);
        } else {
            s_tokenIdsNormal.push(newTokenID);
            s_tokenIdToTokenURIs[newTokenID] = _uri;
            emit PropertyMinted(newTokenID);
        }
    }

    function mint(uint256 _tokenId, uint256 _amount) external {
        require(paused == false, "Minting Paused");
        require(_amount >= 1, "Min investment 1%");
        Property storage property = s_tokenIdToProperties[_tokenId];
        uint256 remainingSupply = MAX_MINT_PER_PROPERTY - property.amountMinted;

        require(remainingSupply >= _amount, "Not enough supply left");
        uint256 usdtAmount = (property.price * _amount) / 100;

        require(
            i_usdt.balanceOf(msg.sender) > usdtAmount,
            "Not enough balance"
        );

        try this.attemptTransfer(msg.sender, address(this), usdtAmount) {
            uint256 _newAmoutnGenerated = property.amountGenerated + usdtAmount;
            property.amountGenerated = _newAmoutnGenerated;
            property.amountMinted += _amount;
            s_userToTokenIdToShares[msg.sender][_tokenId] += _amount;

            bool isInvestorPresent = false;
            for (
                uint256 i = 0;
                i < s_tokenIdToInvestors[_tokenId].length;
                i++
            ) {
                if (s_tokenIdToInvestors[_tokenId][i] == msg.sender) {
                    isInvestorPresent = true;
                    break;
                }
            }
            if (!isInvestorPresent) {
                s_tokenIdToInvestors[_tokenId].push(msg.sender);
            }
            _mint(msg.sender, _tokenId, _amount, "");
        } catch {
            revert NormalRental__TRANSFER_FAILED_mint();
        }
    }

    function mintOffplanInstallments(
        uint256 _tokenId,
        uint256 _amountToOwn,
        uint256 _firstInstalment
    ) external {
        require(
            s_tokenIdToProperties[_tokenId].isOffplan == true,
            "Property not found"
        );
        require(_amountToOwn >= 1, "Max investment 1%");
        require(paused == false, "Minting Paused");
        for (uint256 i = 0; i < s_tokenIdToInstallments[_tokenId].length; i++) {
            if (s_tokenIdToInstallments[_tokenId][i].investor == msg.sender) {
                revert NormalRental__ALREADY_HAVE_INSTALLMENTS_REMAINING();
            }
        }
        Property storage offplanProperty = s_tokenIdToProperties[_tokenId];
        unchecked {
            uint256 firstInstalmentDecAdjusted = _firstInstalment * DECIMALS;
            uint256 remainingsupplyOffplan = MAX_MINT_PER_PROPERTY -
                offplanProperty.amountGenerated;

            require(
                remainingsupplyOffplan >= _amountToOwn,
                "Not enough supply"
            );
            require(
                i_usdt.balanceOf(msg.sender) >= firstInstalmentDecAdjusted,
                "Not enough balance"
            );

            try
                this.attemptTransfer(
                    msg.sender,
                    address(this),
                    firstInstalmentDecAdjusted
                )
            {
                offplanProperty.amountGenerated += firstInstalmentDecAdjusted;
                offplanProperty.amountMinted += _amountToOwn;

                uint256 amountToPay = (offplanProperty.price * _amountToOwn) /
                    100;
                uint256 remainingInstalments = amountToPay -
                    firstInstalmentDecAdjusted;
                // Testing needed
                OffplanInvestor memory offplanInvestor = OffplanInvestor({
                    investor: msg.sender,
                    remainingInstalmentsAmount: remainingInstalments,
                    lastTimestamp: block.timestamp
                });
                s_tokenIdToInstallments[_tokenId].push(offplanInvestor);
                //----------------------------------
                bool isInvestorPresent = false;
                for (
                    uint256 i = 0;
                    i < s_tokenIdToInvestors[_tokenId].length;
                    i++
                ) {
                    if (s_tokenIdToInvestors[_tokenId][i] == msg.sender) {
                        isInvestorPresent = true;
                        break;
                    }
                }
                if (!isInvestorPresent) {
                    s_tokenIdToInvestors[_tokenId].push(msg.sender);
                }
                _mint(msg.sender, _tokenId, _amountToOwn, "");
            } catch {
                revert NormalRental__TRANSFER_FAILED_mintOffplanInstalments();
            }
        }
    }

    function checkUpkeep(
        bytes memory /* checkdata */
    )
        public
        view
        override
        returns (bool upkeepNeeded, bytes memory performData)
    {
        address[] memory defaultedInvestors = new address[](
            s_tokenIdsOffplan.length * 10
        );
        uint256 count = 0;

        for (uint256 i = 0; i < s_tokenIdsOffplan.length; i++) {
            uint256 tokenId = s_tokenIdsOffplan[i];
            OffplanInvestor[] storage investors = s_tokenIdToInstallments[
                tokenId
            ];

            for (uint256 j = 0; j < investors.length; j++) {
                if (
                    block.timestamp - investors[j].lastTimestamp >
                    i_upkeepInterval
                ) {
                    if (count == defaultedInvestors.length) {
                        address[] memory newDefaultedInvestors = new address[](
                            defaultedInvestors.length * 2
                        );
                        for (
                            uint256 k = 0;
                            k < defaultedInvestors.length;
                            k++
                        ) {
                            newDefaultedInvestors[k] = defaultedInvestors[k];
                        }
                        defaultedInvestors = newDefaultedInvestors;
                    }
                    defaultedInvestors[count] = investors[j].investor;
                    count++;
                }
            }
        }

        assembly {
            mstore(defaultedInvestors, count)
        }

        upkeepNeeded = count > 0;
        performData = abi.encode(defaultedInvestors);

        return (upkeepNeeded, performData);
    }

    function performUpkeep(
        bytes calldata /* performdata */
    ) external override {}

    function payInstallments(uint256 _tokenId) external {
        bool foundInvestor = false;
        for (uint256 i = 0; i < s_tokenIdToInstallments[_tokenId].length; i++) {
            if (s_tokenIdToInstallments[_tokenId][i].investor == msg.sender) {
                if (
                    s_tokenIdToInstallments[_tokenId][i]
                        .remainingInstalmentsAmount == 0
                ) {
                    revert NormalRental__NO_INSTALLMENTS_REMAINING();
                }
                foundInvestor = true;
                uint256 installmentToPay = s_tokenIdToInstallments[_tokenId][i]
                    .remainingInstalmentsAmount / 6;
                try
                    this.attemptTransfer(
                        msg.sender,
                        address(this),
                        installmentToPay
                    )
                {
                    uint256 amountAfterTransfer = s_tokenIdToInstallments[
                        _tokenId
                    ][i].remainingInstalmentsAmount - installmentToPay;
                    // Testing needed
                    if (amountAfterTransfer == 0) {
                        delete s_tokenIdToInstallments[_tokenId][i];
                    }
                    s_tokenIdToInstallments[_tokenId][i] = OffplanInvestor({
                        investor: msg.sender,
                        remainingInstalmentsAmount: amountAfterTransfer,
                        lastTimestamp: block.timestamp
                    });
                    //------------------------------
                    break;
                } catch {
                    revert NormalRental__TRANSFER_FAILED_payInstallments();
                }
            }
        }

        if (foundInvestor == false) {
            revert NormalRental__NOT_IN_INSTALLMENTS();
        }
    }

    function submitRent(
        uint256 _usdtAmount,
        uint256 _tokenId
    ) external onlyOwner {
        require(
            i_usdt.balanceOf(msg.sender) >= _usdtAmount,
            "Not enough Balance"
        );
        require(
            bytes(s_tokenIdToTokenURIs[_tokenId]).length != 0,
            "Property not found"
        );

        //Approve first in the front-end / scripts
        try this.attemptTransfer(msg.sender, address(this), _usdtAmount) {
            s_tokenIdToRentGenerated[_tokenId] += _usdtAmount;
        } catch {
            revert NormalRental__TRANSFER_FAILED_submitRent();
        }
    }

    function distributeRent(uint256 _tokenId) external onlyOwner {
        require(s_tokenIdToRentGenerated[_tokenId] > 0, "Rent not generated");
        for (uint256 i = 0; i < s_tokenIdToInvestors[_tokenId].length; i++) {
            address investor = s_tokenIdToInvestors[_tokenId][i];
            uint256 amountToSend = s_userToTokenIdToShares[investor][_tokenId];
            i_usdt.safeTransfer(investor, amountToSend);
            s_userToTokenIdToShares[investor][_tokenId] -= amountToSend;
            s_tokenIdToRentGenerated[_tokenId] -= amountToSend;
        }
    }

    function pause(bool _state) public onlyOwner {
        paused = _state;
    }

    function attemptTransfer(
        address _from,
        address _to,
        uint256 _amount
    ) external {
        require(msg.sender == address(this), "contract call only");
        i_usdt.safeTransferFrom(_from, _to, _amount);
    }

    function uri(
        uint256 _tokenId
    ) public view override returns (string memory) {
        return s_tokenIdToTokenURIs[_tokenId];
    }

    function offplanUri(uint256 _tokenId) public view returns (string memory) {
        return s_offplanTokenIdToURIs[_tokenId];
    }

    function _isValidUri(string memory _uri) internal pure returns (bool) {
        bytes memory startsWith = bytes("https://nft.brickblock");
        bytes memory bytesUri = bytes(_uri);

        if (bytesUri.length < startsWith.length) {
            return false;
        }

        for (uint256 i = 0; i < startsWith.length; i++) {
            if (bytesUri[i] != startsWith[i]) {
                return false;
            }
        }

        return true;
    }

    function uniqueId(
        uint256 _seed,
        address _caller
    ) public view returns (uint256) {
        uint256 uniqueNumber = uint256(
            keccak256(
                abi.encodePacked(
                    blockhash(block.number - 1),
                    block.timestamp,
                    _caller,
                    _seed,
                    s_currentTokenID
                )
            )
        );

        return (uniqueNumber % 10 ** 20);
    }

    function getUsdtAddress() public view returns (IERC20) {
        return i_usdt;
    }

    function getTokenId() public view returns (uint256) {
        return s_currentTokenID;
    }

    function getNormalTokenIds() public view returns (uint256[] memory) {
        return s_tokenIdsNormal;
    }

    function getOffplanTokenIds() public view returns (uint256[] memory) {
        return s_tokenIdsOffplan;
    }

    function getProperties(
        uint256 _tokenId
    ) public view returns (Property memory) {
        return s_tokenIdToProperties[_tokenId];
    }

    function getOffplanProperties(
        uint256 _tokenId
    ) public view returns (Property memory) {
        return s_tokenIdToOffplanProperties[_tokenId];
    }

    function getInvestments(
        address _investor,
        uint256 _tokenId
    ) public view returns (uint256) {
        return s_userToTokenIdToShares[_investor][_tokenId];
    }

    function getInvestors(
        uint256 _tokenId
    ) public view returns (address[] memory) {
        return s_tokenIdToInvestors[_tokenId];
    }

    function getInstallments(
        uint256 _tokenId
    ) public view returns (OffplanInvestor[] memory) {
        return s_tokenIdToInstallments[_tokenId];
    }
}

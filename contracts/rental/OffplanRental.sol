// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract OffplanRental is ERC1155, Ownable {
    error OffplanRental__TRANSFER_FAILED_mint();
    error OffplanRental__ALREADY_HAVE_INSTALLMENTS_REMAINING();
    error OffplanRental__TRANSFER_FAILED_mintOffplanInstalments();

    using SafeERC20 for IERC20;

    struct OffplanInvestor {
        address investor;
        uint256 remainingInstalmentsAmount;
        uint256 lastTimestamp;
        uint256 tokenId;
    }

    struct OffplanProperty {
        uint256 id;
        uint256 price;
        address owner;
        uint256 amountMinted;
        uint256 amountInInstallments;
        uint256 amountGenerated;
        uint256 timestamp;
    }

    struct MissedPayments {
        address missedInvestor;
        uint256 tokenId;
    }

    IERC20 private immutable i_usdt;

    uint256 private s_currentTokenID;
    uint256[] private s_tokenIds;
    uint256 public constant DECIMALS = 10 ** 6;
    uint256 public constant MAX_MINT_PER_PROPERTY = 100;
    uint256 private immutable i_keepersInterval;
    bool public paused;

    OffplanInvestor[] private s_investments;

    mapping(uint256 => OffplanProperty) private s_tokenIdToOffplanProperties;
    mapping(uint256 => string) private s_tokenIdToTokenURIs;
    mapping(address => mapping(uint256 => uint256))
        private s_userToTokenIdToShares;
    mapping(uint256 => address[]) private s_tokenIdToInvestors;

    event OffplanPropertyMinted(uint256 indexed tokenId_, string indexed uri_);
    event OffplanSharesMinted(
        address indexed investor_,
        uint256 indexed tokenId_,
        uint256 amount_,
        uint256 timestamp_
    );
    event PropertyMintedInstallments(
        address indexed investor_,
        uint256 firstInstallment_,
        uint256 remainingAmountToPay_,
        uint256 indexed timestamp_,
        uint256 indexed tokenId_
    );

    constructor(
        address _usdtAddress,
        uint56 _keepersInterval
    ) ERC1155("") Ownable(msg.sender) {
        i_usdt = IERC20(_usdtAddress);
        s_currentTokenID = 0;
        i_keepersInterval = _keepersInterval;
    }

    function addPropertyOffplan(
        string memory _uri,
        uint256 _price,
        uint256 _seed
    ) external onlyOwner {
        require(_isValidUri(_uri), "Please place a valid URI");
        require(_price > 0 && _seed > 0, "Please enter appropriate values");
        uint256 newTokenID = uniqueId(_seed, msg.sender);
        s_currentTokenID = newTokenID;
        uint256 priceDecimals = _price * DECIMALS;
        s_tokenIdToOffplanProperties[newTokenID] = OffplanProperty({
            id: newTokenID,
            price: priceDecimals,
            owner: msg.sender,
            amountMinted: 0, // shares in % for non-installment investments
            amountInInstallments: 0, //Shares in % for installments based investments
            amountGenerated: 0, // amount in usdt
            timestamp: block.timestamp
        });
        s_tokenIdToTokenURIs[newTokenID] = _uri;
        s_tokenIds.push(newTokenID);

        emit OffplanPropertyMinted(newTokenID, _uri);
    }

    function mintOffplanProperty(uint256 _tokenId, uint256 _amount) external {
        require(paused == false, "Minting Paused");
        require(_amount >= 1, "Min investment 1%");

        OffplanProperty storage property = s_tokenIdToOffplanProperties[
            _tokenId
        ];
        uint256 remainingSupply = MAX_MINT_PER_PROPERTY - property.amountMinted;
        require(remainingSupply >= _amount, "Not enough supply left");

        uint256 usdtAmount = (property.price * _amount) / 100;
        require(
            i_usdt.balanceOf(msg.sender) > usdtAmount,
            "Not enough balance"
        );

        uint256 newAmountGenerated = property.amountGenerated + usdtAmount;
        property.amountGenerated = newAmountGenerated;
        property.amountMinted += _amount;
        s_userToTokenIdToShares[msg.sender][_tokenId] += _amount;

        bool isInvestorPresent = false;
        for (uint256 i = 0; i < s_tokenIdToInvestors[_tokenId].length; i++) {
            if (s_tokenIdToInvestors[_tokenId][i] == msg.sender) {
                isInvestorPresent = true;
                break;
            }
        }
        if (!isInvestorPresent) {
            s_tokenIdToInvestors[_tokenId].push(msg.sender);
        }
        emit OffplanSharesMinted(
            msg.sender,
            _tokenId,
            _amount,
            block.timestamp
        );

        try this.attemptTransfer(msg.sender, address(this), usdtAmount) {
            _mint(msg.sender, _tokenId, _amount, "");
        } catch {
            property.amountGenerated -= usdtAmount;
            property.amountMinted -= _amount;
            s_userToTokenIdToShares[msg.sender][_tokenId] -= _amount;
            if (!isInvestorPresent) {
                s_tokenIdToInvestors[_tokenId].pop();
            }
            revert OffplanRental__TRANSFER_FAILED_mint();
        }
    }

    function mintOffplanInstallments(
        uint256 _tokenId,
        uint256 _amountToOwn,
        uint256 _firstInstallment
    ) external {
        require(_amountToOwn >= 1, "Max investment 1%");
        require(paused == false, "Minting Paused");

        OffplanProperty storage property = s_tokenIdToOffplanProperties[
            _tokenId
        ];

        require(
            MAX_MINT_PER_PROPERTY - property.amountMinted > 0,
            "Not enough supply"
        );
        require(
            i_usdt.balanceOf(msg.sender) > (_firstInstallment * DECIMALS),
            "Not enough Balance"
        );

        for (uint256 i = 0; i < s_investments.length; i++) {
            if (s_investments[i].investor == msg.sender) {
                revert OffplanRental__ALREADY_HAVE_INSTALLMENTS_REMAINING();
            }
        }

        uint256 firstInstallmentDecAdjusted = _firstInstallment * DECIMALS;
        uint256 totalPriceToPay = (property.price * _amountToOwn) / 100;
        uint256 amountAfterFirstInstallment = totalPriceToPay -
            _firstInstallment;

        property.amountGenerated += _firstInstallment;
        property.amountInInstallments += _amountToOwn;
        OffplanInvestor memory investorData = OffplanInvestor({
            investor: msg.sender,
            remainingInstalmentsAmount: amountAfterFirstInstallment,
            lastTimestamp: block.timestamp,
            tokenId: _tokenId
        });
        s_investments.push(investorData);

        emit PropertyMintedInstallments(
            msg.sender,
            _firstInstallment,
            amountAfterFirstInstallment,
            block.timestamp,
            _tokenId
        );

        try
            this.attemptTransfer(
                msg.sender,
                address(this),
                firstInstallmentDecAdjusted
            )
        {
            _mint(msg.sender, _tokenId, _amountToOwn, "");
        } catch {
            property.amountGenerated -= _firstInstallment;
            property.amountInInstallments -= _amountToOwn;
            s_investments.pop();
            revert OffplanRental__TRANSFER_FAILED_mintOffplanInstalments();
        }
    }

    function checkUpkeep() external {}

    function performUpkeep() public {}

    function payInstallments() external {}

    function pause(bool _state) external onlyOwner {
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

    function _isValidUri(string memory _uri) internal pure returns (bool) {
        bytes memory startsWith = bytes("https://nft.brickblock.estate");
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
}

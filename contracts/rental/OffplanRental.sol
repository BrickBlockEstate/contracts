// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AutomationCompatibleInterface} from "@chainlink/contracts/src/v0.8/automation/interfaces/AutomationCompatibleInterface.sol";

contract OffplanRental is ERC1155, Ownable, AutomationCompatibleInterface {
    /* Custom Error codes */
    error OffplanRental__TRANSFER_FAILED_mint();
    error OffplanRental__ALREADY_HAVE_INSTALLMENTS_REMAINING();
    error OffplanRental__TRANSFER_FAILED_mintOffplanInstalments();
    error OffplanRental__TRANSFER_FAILED_payInstallments();
    /* SafeERC20 for USDT function calls */
    using SafeERC20 for IERC20;
    /* Type declarations */
    struct OffplanInvestor {
        address investor;
        uint256 firstInstallment;
        uint256 remainingInstalmentsAmount;
        uint256 sharesOwned;
        uint256 lastTimestamp;
        uint256 tokenId;
        uint256 missedPayementCount;
        uint256 monthlyPayment;
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
    OffplanInvestor[] private s_investments;

    IERC20 private immutable i_usdt;
    /* State Variables */
    uint256 private s_currentTokenID;
    uint256[] private s_tokenIds;
    uint256 public constant DECIMALS = 10 ** 6;
    uint256 public constant MAX_MINT_PER_PROPERTY = 100;
    uint256 private immutable i_gracePeriod;
    bool public paused;
    address[] public s_consecutiveDefaulters;
    /* Mappings */
    mapping(uint256 => OffplanProperty) private s_tokenIdToOffplanProperties;
    mapping(uint256 => string) private s_tokenIdToTokenURIs;
    mapping(address => mapping(uint256 => uint256))
        private s_userToTokenIdToShares;
    mapping(uint256 => address[]) private s_tokenIdToInvestors;
    mapping(address => uint256) private s_addressToPanaltyAmount;
    /* Events */
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
    event InstallmentPaid(
        address indexed investor_,
        uint256 indexed tokenId_,
        uint256 paidInstallment_,
        uint256 remainingInstallment_
    );

    event SharesBurnedForConsecutiveMissedPayments(
        address indexed investor_,
        uint256 indexed tokenId_,
        uint256 amountBurned_
    );

    event MissedAmountPenalty(
        address indexed investor_,
        uint256 indexed tokenId_,
        uint256 penalty_,
        uint256 remainingInstallmentsAmount_
    );

    event CompletedInstallments(
        address indexed investor_,
        uint256 indexed tokenId_,
        uint256 sharesOwned
    );

    constructor(
        address _usdtAddress,
        uint56 _gracePeriod
    ) ERC1155("") Ownable(msg.sender) {
        i_usdt = IERC20(_usdtAddress);
        s_currentTokenID = 0;
        i_gracePeriod = _gracePeriod;
    }

    function addOffplanProperty(
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

    //Requires a call to ERC20 Approve function in the front-end
    function mintOffplanProperty(uint256 _tokenId, uint256 _amount) external {
        require(paused == false, "Minting Paused");
        require(_amount >= 1, "Min investment 1%");

        OffplanProperty storage property = s_tokenIdToOffplanProperties[
            _tokenId
        ];
        uint256 remainingSupply = MAX_MINT_PER_PROPERTY -
            (property.amountMinted + property.amountInInstallments);
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

    //Requires a call to ERC20 approve function
    function mintOffplanInstallments(
        uint256 _tokenId,
        uint256 _amountToOwn,
        uint256 _firstInstallment
    ) external {
        require(
            s_tokenIdToOffplanProperties[_tokenId].price > 0,
            "Property not found"
        );
        require(_amountToOwn >= 1, "Min investment 1%");
        require(paused == false, "Minting Paused");

        OffplanProperty storage property = s_tokenIdToOffplanProperties[
            _tokenId
        ];

        require(
            MAX_MINT_PER_PROPERTY -
                (property.amountMinted + property.amountInInstallments) >=
                _amountToOwn,
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
            firstInstallmentDecAdjusted;
        uint256 monthlyPayment = amountAfterFirstInstallment / 6;

        property.amountGenerated += firstInstallmentDecAdjusted;
        property.amountInInstallments += _amountToOwn;
        OffplanInvestor memory investorData = OffplanInvestor({
            investor: msg.sender,
            firstInstallment: firstInstallmentDecAdjusted,
            remainingInstalmentsAmount: amountAfterFirstInstallment,
            sharesOwned: _amountToOwn,
            lastTimestamp: block.timestamp,
            tokenId: _tokenId,
            missedPayementCount: 0,
            monthlyPayment: monthlyPayment
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

    function checkUpkeep(
        bytes memory /* _checkData */
    )
        public
        view
        override
        returns (bool upkeepNeeded, bytes memory performData)
    {
        upkeepNeeded = false;
        OffplanInvestor[] memory investorsToUpdate = new OffplanInvestor[](
            s_investments.length
        );
        uint256 count = 0;
        for (uint256 i = 0; i < s_investments.length; i++) {
            if (
                block.timestamp - s_investments[i].lastTimestamp >=
                i_gracePeriod
            ) {
                investorsToUpdate[count] = s_investments[i];
                count++;
                upkeepNeeded = true;
            }
        }

        assembly {
            mstore(investorsToUpdate, count)
        }

        performData = abi.encode(investorsToUpdate);
    }

    function performUpkeep(bytes calldata performData) external override {
        (bool upkeepNeeded, ) = checkUpkeep("");
        require(upkeepNeeded, "upkeep not needed");

        OffplanInvestor[] memory defaultedInvestors = abi.decode(
            performData,
            (OffplanInvestor[])
        );

        for (uint256 i = 0; i < defaultedInvestors.length; i++) {
            for (uint256 j = 0; j < s_investments.length; j++) {
                if (
                    defaultedInvestors[i].investor == s_investments[j].investor
                ) {
                    OffplanInvestor storage investorData = s_investments[j];
                    address investor = investorData.investor;
                    uint256 penalty = investorData.remainingInstalmentsAmount /
                        20;
                    uint256 monthlyPenalty = investorData.monthlyPayment / 20;
                    investorData.monthlyPayment += monthlyPenalty;
                    s_addressToPanaltyAmount[investor] += penalty;
                    investorData.remainingInstalmentsAmount += penalty;
                    investorData.missedPayementCount += 1;
                    emit MissedAmountPenalty(
                        investor,
                        investorData.tokenId,
                        penalty,
                        investorData.remainingInstalmentsAmount
                    );

                    // Check if the investor has missed 3 consecutive payments
                    if (investorData.missedPayementCount >= 3) {
                        s_consecutiveDefaulters.push(investor);

                        uint256 amountToSend = investorData.firstInstallment -
                            s_addressToPanaltyAmount[investor];
                        _burn(
                            investor,
                            investorData.tokenId,
                            investorData.sharesOwned
                        );
                        investorData = s_investments[s_investments.length - 1];
                        s_investments.pop();
                        if (j > 0) {
                            j--;
                        }
                        i_usdt.safeTransfer(investor, amountToSend);
                        emit SharesBurnedForConsecutiveMissedPayments(
                            investorData.investor,
                            investorData.tokenId,
                            investorData.sharesOwned
                        );
                    } else {
                        // Update the lastTimestamp to the current time after handling the missed payment
                        investorData.lastTimestamp = block.timestamp;
                    }
                }
            }
        }
    }

    // Require a call to ERC20 `approve` function
    function payInstallments(uint256 _tokenId) external {
        for (uint256 i = 0; i < s_consecutiveDefaulters.length; i++) {
            require(
                s_consecutiveDefaulters[i] != msg.sender,
                "3 payments missed"
            );
        }
        bool foundInvestor = false;
        for (uint256 i = 0; i < s_investments.length; i++) {
            if (
                s_investments[i].investor == msg.sender &&
                s_investments[i].tokenId == _tokenId
            ) {
                require(
                    s_investments[i].remainingInstalmentsAmount > 10,
                    "No installments remaining"
                );

                OffplanInvestor storage foundInvestment = s_investments[i];
                foundInvestor = true;

                uint256 payment = foundInvestment.monthlyPayment;
                uint256 remainingAmount = foundInvestment
                    .remainingInstalmentsAmount;
                uint256 amountAfterTransfer = remainingAmount > payment
                    ? remainingAmount - payment
                    : 0;

                // State change
                if (amountAfterTransfer <= 10) {
                    // Checking for near-zero values
                    s_investments[i] = s_investments[s_investments.length - 1];
                    s_investments.pop();
                    emit CompletedInstallments(
                        foundInvestment.investor,
                        foundInvestment.tokenId,
                        foundInvestment.sharesOwned
                    );
                    if (i > 0) {
                        i--;
                    }
                } else {
                    foundInvestment
                        .remainingInstalmentsAmount = amountAfterTransfer;
                    foundInvestment.lastTimestamp = block.timestamp;
                    foundInvestment.firstInstallment += payment;
                    if (foundInvestment.missedPayementCount > 0) {
                        foundInvestment.missedPayementCount = 0;
                    }
                }

                try this.attemptTransfer(msg.sender, address(this), payment) {
                    emit InstallmentPaid(
                        msg.sender,
                        _tokenId,
                        payment,
                        amountAfterTransfer
                    );
                } catch {
                    foundInvestment
                        .remainingInstalmentsAmount = remainingAmount; // Revert changes on failure
                    revert OffplanRental__TRANSFER_FAILED_payInstallments();
                }
                break;
            }
        }

        require(foundInvestor, "Investor not found");
    }

    function pause(bool _state) external onlyOwner {
        paused = _state;
    }

    function attemptTransfer(
        address _from,
        address _to,
        uint256 _amount
    ) public {
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

    function getProperties(
        uint256 _tokenId
    ) public view returns (OffplanProperty memory) {
        return s_tokenIdToOffplanProperties[_tokenId];
    }

    function uri(
        uint256 _tokenId
    ) public view override returns (string memory) {
        return s_tokenIdToTokenURIs[_tokenId];
    }

    function getInvestments() public view returns (OffplanInvestor[] memory) {
        return s_investments;
    }
}

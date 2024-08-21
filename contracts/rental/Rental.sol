// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.26;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Rental is ERC1155, Ownable {
    /* Custom error codes */
    error Rental__TRANSFER_FAILED_mint();
    error Rental__TRANSFER_FAILED_submitRent();
    error Ownership__Transfer_Failed_withdraw();
    /* Safe ERC20 for USDT function calls */
    using SafeERC20 for IERC20;
    /* TYpe declarations */
    struct Property {
        uint256 id;
        uint256 price;
        address owner;
        uint256 amountMinted;
        uint256 amountGenerated;
        uint256 timestamp;
    }

    IERC20 private immutable i_usdt;
    /* State variables */
    uint256 private s_currentTokenID;
    uint256[] private s_tokenIds;
    uint256 public constant DECIMALS = 10 ** 6;
    uint256 public constant MAX_MINT_PER_PROPERTY = 100;
    bool public paused = false;
    /* Mappings */
    mapping(uint256 => Property) private s_tokenIdToProperties;
    mapping(uint256 => string) private s_tokenIdToTokenURIs;
    mapping(address => mapping(uint256 => uint256))
        private s_userToTokenIdToShares;
    mapping(uint256 => address[]) private s_tokenIdToInvestors;
    mapping(uint256 => uint256) private s_tokenIdToRentGenerated;
    /* Evenets */
    event WithdrawSuccessful(address indexed owner_, uint256 amountWithdrawn_);
    event PropertyMinted(uint256 indexed tokenId_, string indexed uri_);
    event RentalSharesMinted(
        address indexed investor_,
        uint256 indexed tokenId_,
        uint256 amount_,
        uint256 indexed timestamp_
    );
    event RentSubmitted(uint256 indexed tokenId_, uint256 indexed amount_);
    event RentDistributed(address indexed investor_, uint256 indexed amount_);

    constructor(address _usdtAddress) ERC1155("") Ownable(msg.sender) {
        i_usdt = IERC20(_usdtAddress);
        s_currentTokenID = 0;
    }

    function addProperty(
        string memory _uri,
        uint256 _price,
        uint256 _seed
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
            timestamp: block.timestamp
        });
        s_tokenIdToTokenURIs[newTokenID] = _uri;
        s_tokenIds.push(newTokenID);

        emit PropertyMinted(newTokenID, _uri);
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
        emit RentalSharesMinted(msg.sender, _tokenId, _amount, block.timestamp);

        try this.attemptTransfer(msg.sender, address(this), usdtAmount) {
            _mint(msg.sender, _tokenId, _amount, "");
        } catch {
            // Revert state changes on failure
            property.amountGenerated -= usdtAmount;
            property.amountMinted -= _amount;
            s_userToTokenIdToShares[msg.sender][_tokenId] -= _amount;
            if (!isInvestorPresent) {
                s_tokenIdToInvestors[_tokenId].pop();
            }
            revert Rental__TRANSFER_FAILED_mint();
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

        s_tokenIdToRentGenerated[_tokenId] += _usdtAmount;
        emit RentSubmitted(_tokenId, _usdtAmount);

        try
            this.attemptTransfer(msg.sender, address(this), _usdtAmount)
        {} catch {
            s_tokenIdToRentGenerated[_tokenId] -= _usdtAmount;
            revert Rental__TRANSFER_FAILED_submitRent();
        }
    }

    function distributeRent(uint256 _tokenId) external onlyOwner {
        require(s_tokenIdToRentGenerated[_tokenId] > 0, "Rent not generated");
        for (uint256 i = 0; i < s_tokenIdToInvestors[_tokenId].length; i++) {
            address investor = s_tokenIdToInvestors[_tokenId][i];
            uint256 amountToSend = s_userToTokenIdToShares[investor][_tokenId];
            s_userToTokenIdToShares[investor][_tokenId] -= amountToSend;
            s_tokenIdToRentGenerated[_tokenId] -= amountToSend;
            i_usdt.safeTransfer(investor, amountToSend);
        }
    }

    function pause(bool _state) external onlyOwner {
        paused = _state;
    }

    function withdraw() external onlyOwner {
        uint256 contractBalance = i_usdt.balanceOf(address(this));
        require(contractBalance > 0, "Contract empty");

        i_usdt.safeTransfer(msg.sender, contractBalance);

        emit WithdrawSuccessful(msg.sender, contractBalance);
    }

    /* Helper Functions */

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

    function attemptTransfer(
        address _from,
        address _to,
        uint256 _amount
    ) public {
        require(msg.sender == address(this), "contract call only");
        i_usdt.safeTransferFrom(_from, _to, _amount);
    }

    /* View functions */
    function getTokenId() public view returns (uint256) {
        return s_currentTokenID;
    }

    function getTokenIds() public view returns (uint256[] memory) {
        return s_tokenIds;
    }

    function uri(
        uint256 _tokenId
    ) public view override returns (string memory) {
        return s_tokenIdToTokenURIs[_tokenId];
    }

    function getProperties(
        uint256 _tokenId
    ) public view returns (Property memory) {
        return s_tokenIdToProperties[_tokenId];
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
}

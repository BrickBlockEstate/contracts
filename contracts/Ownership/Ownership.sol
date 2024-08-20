// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.26;

import {ERC721, ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Ownership is ERC721URIStorage, Ownable {
    using SafeERC20 for IERC20;
    struct Property {
        uint256 price;
        address owner;
        uint256 timestamp;
    }

    //For now this is the tokenID
    uint256 private s_tokenIdCounter;
    uint256 public constant DECIMALS = 1e6;
    IERC20 public immutable i_usdt;

    mapping(uint256 => Property) private s_tokenIdToProperty;

    constructor(
        IERC20 _usdt
    ) ERC721("Brick Blocks Listing", "BBL") Ownable(msg.sender) {
        s_tokenIdCounter = 0;
        i_usdt = _usdt;
    }

    function addListing(
        string memory _tokenUri,
        uint256 _price
    ) external onlyOwner {
        s_tokenIdCounter++;
        uint256 currentTokenId = s_tokenIdCounter;
        uint256 priceDecAdjusted = _price * DECIMALS;
        s_tokenIdToProperty[currentTokenId] = Property({
            price: priceDecAdjusted,
            owner: msg.sender,
            timestamp: block.timestamp
        });

        _setTokenURI(currentTokenId, _tokenUri);
        _safeMint(msg.sender, currentTokenId);
    }

    function buyOwnership(uint256 _tokenId) external {
        Property storage property = s_tokenIdToProperty[_tokenId];
        require(property.price > 0, "Property doesn't exist");
        require(i_usdt.balanceOf(msg.sender) >= property.price);

        uint256 amountToPay = property.price;
        address prevOwner = property.owner;
        property.owner = msg.sender;
        property.timestamp = block.timestamp;

        try this.attemptTransfer(msg.sender, address(this), amountToPay) {
            _transfer(property.owner, msg.sender, _tokenId);
        } catch {
            property.owner = prevOwner;
        }
    }

    function attemptTransfer(
        address _from,
        address _to,
        uint256 _amount
    ) public {
        require(msg.sender == address(this), "contract call only");
        i_usdt.safeTransferFrom(_from, _to, _amount);
    }

    function getTokenCounter() public view returns (uint256) {
        return s_tokenIdCounter;
    }
}

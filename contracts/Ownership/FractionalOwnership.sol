// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.26;

import {ERC721, ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract FractionalOwnership is ERC721URIStorage, Ownable {
    struct Property {
        uint256 price;
        address owner;
        uint256 timestamp;
    }

    //For now this is the tokenID
    uint256 private s_tokenIdCounter;

    mapping(address => string[]) private s_ownerToTokenUri;
    mapping(uint256 => Property) private s_tokenIdToProperty;

    constructor() ERC721("Brick Blocks Listing", "BBL") Ownable(msg.sender) {
        s_tokenIdCounter = 0;
    }

    function addListing(
        string memory _tokenUri,
        uint256 _price
    ) external onlyOwner {
        s_tokenIdCounter++;
        uint256 currentTokenId = s_tokenIdCounter;
        s_tokenIdToProperty[currentTokenId] = Property({
            price: _price,
            owner: msg.sender,
            timestamp: block.timestamp
        });
        s_ownerToTokenUri[msg.sender].push(_tokenUri);

        _setTokenURI(currentTokenId, _tokenUri);
        _safeMint(msg.sender, currentTokenId);
    }

    function buyOwnership(uint256 _tokenId) external {}

    function getTokenCounter() public view returns (uint256) {
        return s_tokenIdCounter;
    }

    function getURI(address _user) public view returns (string[] memory) {
        return s_ownerToTokenUri[_user];
    }
}

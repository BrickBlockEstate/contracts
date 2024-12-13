// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.26;
import {ERC721URIStorage, ERC721} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

contract Listing is ERC721URIStorage {
    struct Property {
        uint256 price;
        uint256 users;
        uint256 ratting;
        address owner;
    }
    uint256 private s_tokenCounter = 0;

    constructor() ERC721("IN BNB", "IBNB") {}

    function addListing(
        string memory _listingUri,
        uint256 _priceInUsdt
    ) external {}
}

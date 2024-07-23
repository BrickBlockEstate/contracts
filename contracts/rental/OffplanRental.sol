// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.24;

contract OffplanRental {
    struct Property {
        uint256 id;
        uint256 amountToGenerate;
        address owner;
        uint256 sharesMinted;
    }
}

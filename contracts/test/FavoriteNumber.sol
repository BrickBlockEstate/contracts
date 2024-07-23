// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.24;

contract FavoriteNumber {
    uint256 public s_favoriteNumber;
    event NewNumberAdded(uint256 indexed newNumber_);

    function updateFavoriteNumber(uint256 _newNumber) external {
        s_favoriteNumber = _newNumber;
        emit NewNumberAdded(_newNumber);
    }
}
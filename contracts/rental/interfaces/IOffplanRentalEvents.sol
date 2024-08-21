// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.26;

interface IOffplanRentalEvents {
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

    event WithdrawSuccessful(address indexed owner_, uint256 amountWithdrawn_);
}

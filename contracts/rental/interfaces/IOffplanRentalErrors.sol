// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.26;

interface IOffplanRentalErrors {
    error OffplanRental__TRANSFER_FAILED_mint();
    error OffplanRental__ALREADY_HAVE_INSTALLMENTS_REMAINING();
    error OffplanRental__TRANSFER_FAILED_mintOffplanInstalments();
    error OffplanRental__TRANSFER_FAILED_payInstallments();
}

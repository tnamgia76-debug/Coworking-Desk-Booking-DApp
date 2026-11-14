// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract CoworkingDeskBooking {
    // Dia chi quan ly, duoc gan khi trien khai contract.
    address public immutable manager;

    uint256 public constant TOTAL_DESKS = 12;
    uint256 public dailyRate = 0.02 ether;

    // So ban => ngay UTC => dia chi nguoi dat.
    // Ngay duoc bieu dien bang timestamp luc 00:00:00 UTC.
    mapping(uint256 => mapping(uint256 => address)) private bookings;

    event DailyRateUpdated(uint256 oldRate, uint256 newRate);

    event DeskBooked(
        uint256 indexed deskId,
        uint256 indexed bookingDate,
        address indexed customer,
        uint256 amount
    );

    constructor() {
        manager = msg.sender;
    }

    modifier onlyManager() {
        require(msg.sender == manager, "Only manager");
        _;
    }

    function setDailyRate(uint256 newRate) external onlyManager {
        require(newRate > 0, "Rate must be positive");

        uint256 oldRate = dailyRate;
        dailyRate = newRate;

        emit DailyRateUpdated(oldRate, newRate);
    }

    function bookDesk(
        uint256 deskId,
        uint256 bookingDate
    ) external payable {
        validateDeskAndDate(deskId, bookingDate);

        uint256 todayUTC =
            (block.timestamp / 1 days) * 1 days;

        require(
            bookingDate > todayUTC,
            "Booking must be a future date"
        );

        require(
            bookings[deskId][bookingDate] == address(0),
            "Desk already booked"
        );

        require(msg.value == dailyRate, "Incorrect payment");

        bookings[deskId][bookingDate] = msg.sender;

        emit DeskBooked(
            deskId,
            bookingDate,
            msg.sender,
            msg.value
        );
    }

    function getBookingOwner(
        uint256 deskId,
        uint256 bookingDate
    ) external view returns (address) {
        validateDeskAndDate(deskId, bookingDate);

        return bookings[deskId][bookingDate];
    }

    function isDeskAvailable(
        uint256 deskId,
        uint256 bookingDate
    ) external view returns (bool) {
        validateDeskAndDate(deskId, bookingDate);

        uint256 todayUTC =
            (block.timestamp / 1 days) * 1 days;

        return
            bookingDate > todayUTC &&
            bookings[deskId][bookingDate] == address(0);
    }

    function validateDeskAndDate(
        uint256 deskId,
        uint256 bookingDate
    ) internal pure {
        require(
            deskId >= 1 && deskId <= TOTAL_DESKS,
            "Desk must be from 1 to 12"
        );

        require(
            bookingDate % 1 days == 0,
            "Date must be midnight UTC"
        );
    }
}
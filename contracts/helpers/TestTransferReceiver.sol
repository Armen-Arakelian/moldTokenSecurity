// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TestTransferReceiver {
    address public token;

    event TransferReceived(
        address token,
        address sender,
        uint256 value,
        bytes data
    );
    event ApprovalReceived(
        address token,
        address spender,
        uint256 value,
        bytes data
    );

    function onTokenTransfer(
        address sender,
        uint256 value,
        bytes calldata data
    ) external returns (bool) {
        emit TransferReceived(msg.sender, sender, value, data);
        return true;
    }

    function onTokenApproval(
        address spender,
        uint256 value,
        bytes calldata data
    ) external returns (bool) {
        emit ApprovalReceived(msg.sender, spender, value, data);
        return true;
    }

    function transfer(
        address token,
        address destination,
        uint256 value
    ) external {
        IERC20(token).transfer(destination, value);
    }
}

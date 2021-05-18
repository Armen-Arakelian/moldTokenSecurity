// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.6;

import "./IERC20.sol";
import "./IERC2612.sol";

interface IMoldSecurityToken is IERC20, IERC2612 {
    function deposit(uint256 value) external;

    function depositTo(address to, uint256 value) external;

    function withdraw(uint256 value) external;

    function withdrawTo(address to, uint256 value) external;

    function withdrawFrom(
        address from,
        address to,
        uint256 value
    ) external;

    function depositToAndCall(
        address to,
        uint256 value,
        bytes calldata data
    ) external returns (bool);

    function approveAndCall(
        address spender,
        uint256 value,
        bytes calldata data
    ) external returns (bool);

    function transferAndCall(
        address to,
        uint256 value,
        bytes calldata data
    ) external returns (bool);
}

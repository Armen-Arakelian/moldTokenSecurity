// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.7.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ERC20Mock is ERC20("Test", "Test") {
    constructor() {
        _mint(msg.sender, 1000000000000000000000000000);
    }
}

// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.6;

import "./MoldSecurityToken.sol";

interface IERC20Detailed {
    function name() external view returns (string memory);

    function symbol() external view returns (string memory);

    function decimals() external view returns (uint8);
}

contract MoldSecurityFactory {
    uint256 constant salt = 42;

    mapping(address => bool) createdContracts;

    event Deployed(address addr);

    function getCreationBytecode(address tokenToMoldAddress)
        public
        view
        returns (bytes memory)
    {
        bytes memory bytecode = type(MoldSecurityToken).creationCode;

        string memory name = IERC20Detailed(tokenToMoldAddress).name();
        string memory symbol = IERC20Detailed(tokenToMoldAddress).symbol();
        uint8 decimals = IERC20Detailed(tokenToMoldAddress).decimals();

        name = string(abi.encodePacked("Mold Security ", name));
        symbol = string(abi.encodePacked("MS", symbol));

        return
            abi.encodePacked(
                bytecode,
                abi.encode(tokenToMoldAddress, name, symbol, decimals)
            );
    }

    function deployMoldToken(address tokenToMoldAddress)
        public
        returns (address)
    {
        require(
            !createdContracts[tokenToMoldAddress],
            "MoldSecurityFactory: Attemt to mold already mold token"
        );

        bytes memory bytecode = getCreationBytecode(tokenToMoldAddress);

        address addr;
        assembly {
            addr := create2(0, add(bytecode, 0x20), mload(bytecode), salt)

            if iszero(extcodesize(addr)) {
                revert(0, 0)
            }
        }

        createdContracts[addr] = true;

        emit Deployed(addr);
        return addr;
    }
}

// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.6;

import "./interfaces/IMoldSecurityToken.sol";

interface ITransferReceiver {
    function onTokenTransfer(
        address,
        uint256,
        bytes calldata
    ) external returns (bool);
}

interface IApprovalReceiver {
    function onTokenApproval(
        address,
        uint256,
        bytes calldata
    ) external returns (bool);
}

/// @dev Wrapped ERC20 to MoldSecurityToken. Created for preventing sandwich attacks. You can `deposit` ERC20 and obtain a MoldSecurityToken balance which can then be operated as an ERC-20 token. You can
/// `withdraw` ERC20 from MoldSecurityToken, which will then burn MoldSecurityToken token in your wallet. The amount of MoldSecurityToken token in any wallet is always identical to the
/// balance of ERC20 deposited minus the ERC20 withdrawn with that specific wallet.
contract MoldSecurityToken is IMoldSecurityToken {
    bytes32 public immutable PERMIT_TYPEHASH =
        keccak256(
            "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
        );
    uint256 public immutable deploymentChainId;
    bytes32 private immutable _DOMAIN_SEPARATOR;

    string public name;
    string public symbol;
    uint8 public decimals;

    IERC20 tokenToMold;

    mapping(address => uint256) lastBlockReceived;

    /// @dev Records amount of MoldSecurityToken token owned by account.
    mapping(address => uint256) public override balanceOf;

    /// @dev Records current ERC2612 nonce for account. This value must be included whenever signature is generated for {permit}.
    /// Every successful call to {permit} increases account's nonce by one. This prevents signature from being used multiple times.
    mapping(address => uint256) public override nonces;

    /// @dev Records number of MoldSecurityToken token that account (second) will be allowed to spend on behalf of another account (first) through {transferFrom}.
    mapping(address => mapping(address => uint256)) public override allowance;

    constructor(
        address tokenToMoldAddress,
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) {
        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        deploymentChainId = chainId;
        _DOMAIN_SEPARATOR = _calculateDomainSeparator(chainId);

        tokenToMold = IERC20(tokenToMoldAddress);

        name = _name;
        symbol = _symbol;
        decimals = _decimals;
    }

    /// @dev Calculate the DOMAIN_SEPARATOR.
    function _calculateDomainSeparator(uint256 chainId)
        private
        view
        returns (bytes32)
    {
        return
            keccak256(
                abi.encode(
                    keccak256(
                        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                    ),
                    keccak256(bytes(name)),
                    keccak256(bytes("1")),
                    chainId,
                    address(this)
                )
            );
    }

    function _moldSecurityFeature(address user) private view returns (bool) {
        return (block.number - lastBlockReceived[user] > 2);
    }

    /// @dev Return the DOMAIN_SEPARATOR.
    function DOMAIN_SEPARATOR() external view override returns (bytes32) {
        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        return
            chainId == deploymentChainId
                ? _DOMAIN_SEPARATOR
                : _calculateDomainSeparator(chainId);
    }

    /// @dev Returns the total supply of MoldSecurityToken token as the ERC20 held in this contract.
    function totalSupply() external view override returns (uint256) {
        return tokenToMold.balanceOf(address(this));
    }

    /// @dev `value` of ERC20 sent to this contract grants caller account a matching increase in MoldSecurityToken token balance.
    /// Emits {Transfer} event to reflect MoldSecurityToken token mint of `value` from `address(0)` to caller account.
    function deposit(uint256 value) external override {
        // _mintTo(msg.sender, value);
        balanceOf[msg.sender] += value;
        lastBlockReceived[msg.sender] = block.number;

        tokenToMold.transferFrom(msg.sender, address(this), value);
        emit Transfer(address(0), msg.sender, value);
    }

    /// @dev `value` of ERC20 sent to this contract grants `to` account a matching increase in MoldSecurityToken token balance.
    /// Emits {Transfer} event to reflect MoldSecurityToken token mint of `value` from `address(0)` to `to` account.
    function depositTo(address to, uint256 value) external override {
        // _mintTo(to, value);
        balanceOf[to] += value;
        lastBlockReceived[to] = block.number;

        tokenToMold.transferFrom(msg.sender, address(this), value);
        emit Transfer(address(0), to, value);
    }

    /// @dev `value` of ERC20 sent to this contract grants `to` account a matching increase in MoldSecurityToken token balance,
    /// after which a call is executed to an ERC677-compliant contract with the `data` parameter.
    /// Emits {Transfer} event.
    /// Returns boolean value indicating operation succeeded.
    /// For more information on {transferAndCall} format, see https://github.com/ERC20ereum/EIPs/issues/677.
    function depositToAndCall(
        address to,
        uint256 value,
        bytes calldata data
    ) external override returns (bool success) {
        // _mintTo(to, value);
        balanceOf[to] += value;
        lastBlockReceived[to] = block.number;

        tokenToMold.transferFrom(msg.sender, address(this), value);
        emit Transfer(address(0), to, value);

        return ITransferReceiver(to).onTokenTransfer(msg.sender, value, data);
    }

    /// @dev Burn `value` MoldSecurityToken token from caller account and withdraw matching ERC20 to the same.
    /// Emits {Transfer} event to reflect MoldSecurityToken token burn of `value` to `address(0)` from caller account.
    /// Requirements:
    ///   - caller account must have at least `value` balance of MoldSecurityToken token.
    function withdraw(uint256 value) external override {
        // _burnFrom(msg.sender, value);
        uint256 balance = balanceOf[msg.sender];
        require(
            balance >= value,
            "MoldSecurityToken: burn amount exceeds balance"
        );
        balanceOf[msg.sender] = balance - value;
        emit Transfer(msg.sender, address(0), value);

        tokenToMold.transfer(msg.sender, value);
    }

    /// @dev Burn `value` MoldSecurityToken token from caller account and withdraw matching ERC20 to account (`to`).
    /// Emits {Transfer} event to reflect MoldSecurityToken token burn of `value` to `address(0)` from caller account.
    /// Requirements:
    ///   - caller account must have at least `value` balance of MoldSecurityToken token.
    function withdrawTo(address to, uint256 value) external override {
        // _burnFrom(msg.sender, value);
        uint256 balance = balanceOf[msg.sender];
        require(
            balance >= value,
            "MoldSecurityToken: burn amount exceeds balance"
        );
        balanceOf[msg.sender] = balance - value;
        emit Transfer(msg.sender, address(0), value);

        tokenToMold.transfer(to, value);
    }

    /// @dev Burn `value` MoldSecurityToken token from account (`from`) and withdraw matching ERC20 to account (`to`).
    /// Emits {Approval} event to reflect reduced allowance `value` for caller account to spend from account (`from`),
    /// unless allowance is set to `type(uint256).max`
    /// Emits {Transfer} event to reflect MoldSecurityToken token burn of `value` to `address(0)` from account (`from`).
    /// Requirements:
    ///   - `from` account must have at least `value` balance of MoldSecurityToken token.
    ///   - `from` account must have approved caller to spend at least `value` of MoldSecurityToken token, unless `from` and caller are the same account.
    function withdrawFrom(
        address from,
        address to,
        uint256 value
    ) external override {
        if (from != msg.sender) {
            // _decreaseAllowance(from, msg.sender, value);
            uint256 allowed = allowance[from][msg.sender];
            if (allowed != type(uint256).max) {
                require(
                    allowed >= value,
                    "MoldSecurityToken: request exceeds allowance"
                );
                uint256 reduced = allowed - value;
                allowance[from][msg.sender] = reduced;
                emit Approval(from, msg.sender, reduced);
            }
        }

        // _burnFrom(from, value);
        uint256 balance = balanceOf[from];
        require(
            balance >= value,
            "MoldSecurityToken: burn amount exceeds balance"
        );
        balanceOf[from] = balance - value;
        emit Transfer(from, address(0), value);

        tokenToMold.transfer(to, value);
    }

    /// @dev Sets `value` as allowance of `spender` account over caller account's MoldSecurityToken token.
    /// Emits {Approval} event.
    /// Returns boolean value indicating operation succeeded.
    function approve(address spender, uint256 value)
        external
        override
        returns (bool)
    {
        // _approve(msg.sender, spender, value);
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);

        return true;
    }

    /// @dev Sets `value` as allowance of `spender` account over caller account's MoldSecurityToken token,
    /// after which a call is executed to an ERC677-compliant contract with the `data` parameter.
    /// Emits {Approval} event.
    /// Returns boolean value indicating operation succeeded.
    /// For more information on {approveAndCall} format, see https://github.com/ERC20ereum/EIPs/issues/677.
    function approveAndCall(
        address spender,
        uint256 value,
        bytes calldata data
    ) external override returns (bool) {
        // _approve(msg.sender, spender, value);
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);

        return
            IApprovalReceiver(spender).onTokenApproval(msg.sender, value, data);
    }

    /// @dev Sets `value` as allowance of `spender` account over `owner` account's MoldSecurityToken token, given `owner` account's signed approval.
    /// Emits {Approval} event.
    /// Requirements:
    ///   - `deadline` must be timestamp in future.
    ///   - `v`, `r` and `s` must be valid `secp256k1` signature from `owner` account over EIP712-formatted function arguments.
    ///   - the signature must use `owner` account's current nonce (see {nonces}).
    ///   - the signer cannot be `address(0)` and must be `owner` account.
    /// For more information on signature format, see https://eips.ERC20ereum.org/EIPS/eip-2612#specification[relevant EIP section].
    /// MoldSecurityToken token implementation adapted from https://github.com/albertocuestacanada/ERC20Permit/blob/master/contracts/ERC20Permit.sol.
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external override {
        require(
            block.timestamp <= deadline,
            "MoldSecurityToken: Expired permit"
        );

        uint256 chainId;
        assembly {
            chainId := chainid()
        }

        bytes32 hashStruct =
            keccak256(
                abi.encode(
                    PERMIT_TYPEHASH,
                    owner,
                    spender,
                    value,
                    nonces[owner]++,
                    deadline
                )
            );

        bytes32 hash =
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    chainId == deploymentChainId
                        ? _DOMAIN_SEPARATOR
                        : _calculateDomainSeparator(chainId),
                    hashStruct
                )
            );

        address signer = ecrecover(hash, v, r, s);
        require(
            signer != address(0) && signer == owner,
            "MoldSecurityToken: invalid permit"
        );

        // _approve(owner, spender, value);
        allowance[owner][spender] = value;
        emit Approval(owner, spender, value);
    }

    /// @dev Moves `value` MoldSecurityToken token from caller's account to account (`to`).
    /// A transfer to `address(0)` triggers an ERC20 withdraw matching the sent MoldSecurityToken token in favor of caller.
    /// Emits {Transfer} event.
    /// Returns boolean value indicating operation succeeded.
    /// Requirements:
    ///   - caller account must have at least `value` MoldSecurityToken token.
    function transfer(address to, uint256 value)
        external
        override
        returns (bool)
    {
        // _transferFrom(msg.sender, to, value);
        if (to != address(0)) {
            // Transfer
            uint256 balance = balanceOf[msg.sender];
            require(
                balance >= value,
                "MoldSecurityToken: transfer amount exceeds balance"
            );

            require(
                _moldSecurityFeature(msg.sender),
                "MoldSecurityToken: not enough blocks passed from previous transfer"
            );

            balanceOf[msg.sender] = balance - value;
            balanceOf[to] += value;
            lastBlockReceived[to] = block.number;

            emit Transfer(msg.sender, to, value);
        } else {
            // Withdraw
            uint256 balance = balanceOf[msg.sender];
            require(
                balance >= value,
                "MoldSecurityToken: burn amount exceeds balance"
            );
            balanceOf[msg.sender] = balance - value;
            emit Transfer(msg.sender, address(0), value);

            tokenToMold.transfer(msg.sender, value);
        }

        return true;
    }

    /// @dev Moves `value` MoldSecurityToken token from account (`from`) to account (`to`) using allowance mechanism.
    /// `value` is then deducted from caller account's allowance, unless set to `type(uint256).max`.
    /// A transfer to `address(0)` triggers an ERC20 withdraw matching the sent MoldSecurityToken token in favor of caller.
    /// Emits {Approval} event to reflect reduced allowance `value` for caller account to spend from account (`from`),
    /// unless allowance is set to `type(uint256).max`
    /// Emits {Transfer} event.
    /// Returns boolean value indicating operation succeeded.
    /// Requirements:
    ///   - `from` account must have at least `value` balance of MoldSecurityToken token.
    ///   - `from` account must have approved caller to spend at least `value` of MoldSecurityToken token, unless `from` and caller are the same account.
    function transferFrom(
        address from,
        address to,
        uint256 value
    ) external override returns (bool) {
        if (from != msg.sender) {
            // _decreaseAllowance(from, msg.sender, value);
            uint256 allowed = allowance[from][msg.sender];
            if (allowed != type(uint256).max) {
                require(
                    allowed >= value,
                    "MoldSecurityToken: request exceeds allowance"
                );
                uint256 reduced = allowed - value;
                allowance[from][msg.sender] = reduced;
                emit Approval(from, msg.sender, reduced);
            }
        }

        // _transferFrom(from, to, value);
        if (to != address(0)) {
            // Transfer
            uint256 balance = balanceOf[from];
            require(
                balance >= value,
                "MoldSecurityToken: transfer amount exceeds balance"
            );

            require(
                _moldSecurityFeature(from),
                "MoldSecurityToken: not enough blocks passed from previous transfer"
            );

            balanceOf[from] = balance - value;
            balanceOf[to] += value;
            lastBlockReceived[to] = block.number;

            emit Transfer(from, to, value);
        } else {
            // Withdraw
            uint256 balance = balanceOf[from];
            require(
                balance >= value,
                "MoldSecurityToken: burn amount exceeds balance"
            );
            balanceOf[from] = balance - value;
            emit Transfer(from, address(0), value);

            tokenToMold.transfer(msg.sender, value);
        }

        return true;
    }

    /// @dev Moves `value` MoldSecurityToken token from caller's account to account (`to`),
    /// after which a call is executed to an ERC677-compliant contract with the `data` parameter.
    /// A transfer to `address(0)` triggers an ERC20 withdraw matching the sent MoldSecurityToken token in favor of caller.
    /// Emits {Transfer} event.
    /// Returns boolean value indicating operation succeeded.
    /// Requirements:
    ///   - caller account must have at least `value` MoldSecurityToken token.
    /// For more information on {transferAndCall} format, see https://github.com/ERC20ereum/EIPs/issues/677.
    function transferAndCall(
        address to,
        uint256 value,
        bytes calldata data
    ) external override returns (bool) {
        // _transferFrom(msg.sender, to, value);
        if (to != address(0)) {
            // Transfer
            uint256 balance = balanceOf[msg.sender];
            require(
                balance >= value,
                "MoldSecurityToken: transfer amount exceeds balance"
            );

            require(
                _moldSecurityFeature(msg.sender),
                "MoldSecurityToken: not enough blocks passed from previous transfer"
            );

            balanceOf[msg.sender] = balance - value;
            balanceOf[to] += value;
            lastBlockReceived[to] = block.number;

            emit Transfer(msg.sender, to, value);
        } else {
            // Withdraw
            uint256 balance = balanceOf[msg.sender];
            require(
                balance >= value,
                "MoldSecurityToken: burn amount exceeds balance"
            );
            balanceOf[msg.sender] = balance - value;
            emit Transfer(msg.sender, address(0), value);

            tokenToMold.transfer(msg.sender, value);
        }

        return ITransferReceiver(to).onTokenTransfer(msg.sender, value, data);
    }
}

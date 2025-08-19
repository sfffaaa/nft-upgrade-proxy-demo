// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Utils.sol";

/**
 * @dev Custom transparent proxy that accepts a ProxyAdmin address directly
 * without creating a new ProxyAdmin instance. This ensures our main ProxyAdmin
 * has direct control over all deployed proxies.
 */
contract CustomTransparentProxy is ERC1967Proxy {
    address private immutable _admin;

    /**
     * @dev Error thrown when proxy admin tries to call the implementation directly
     */
    error ProxyDeniedAdminAccess();

    /**
     * @dev Initialize the proxy with implementation, admin, and init data
     */
    constructor(
        address implementation,
        address admin,
        bytes memory data
    ) payable ERC1967Proxy(implementation, data) {
        _admin = admin;
        // Set the admin in ERC1967 storage and emit event
        ERC1967Utils.changeAdmin(admin);
    }

    /**
     * @dev Returns the admin of this proxy
     */
    function _proxyAdmin() internal view returns (address) {
        return _admin;
    }

    /**
     * @dev Transparent proxy pattern: admin calls are handled specially
     */
    function _fallback() internal virtual override {
        if (msg.sender == _proxyAdmin()) {
            // Admin can only call upgradeToAndCall
            if (msg.sig == bytes4(keccak256("upgradeToAndCall(address,bytes)"))) {
                _dispatchUpgradeToAndCall();
            } else {
                revert ProxyDeniedAdminAccess();
            }
        } else {
            // All other calls are forwarded to implementation
            super._fallback();
        }
    }

    /**
     * @dev Handle upgrade calls from admin
     */
    function _dispatchUpgradeToAndCall() private {
        (address newImplementation, bytes memory data) = abi.decode(msg.data[4:], (address, bytes));
        ERC1967Utils.upgradeToAndCall(newImplementation, data);
    }
}
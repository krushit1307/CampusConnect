// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

/**
 * @title DonorAdvisedFund
 * @dev Intercepts large donations of volatile tokens and liquidates them automatically
 * on Uniswap V3 to USDC to lock in fiat purchasing power.
 */
contract DonorAdvisedFund is Ownable {
    ISwapRouter public immutable swapRouter;
    IERC20 public immutable usdcToken;

    event DonationRouted(
        address indexed donor,
        address indexed recipientClub,
        address volatileToken,
        uint256 amountIn,
        uint256 amountOutUSDC
    );

    constructor(address _swapRouter, address _usdcToken) Ownable(msg.sender) {
        swapRouter = ISwapRouter(_swapRouter);
        usdcToken = IERC20(_usdcToken);
    }

    /**
     * @notice Accepts volatile token, swaps it atomically for USDC, and sends it to the recipient.
     */
    function routeDonation(
        address _recipientClubWallet,
        address _volatileToken,
        uint256 _amount
    ) external returns (uint256) {
        require(_amount > 0, "Amount must be greater than zero");
        require(_recipientClubWallet != address(0), "Invalid recipient wallet");

        // 1. Transfer volatile token to DAF contract
        require(
            IERC20(_volatileToken).transferFrom(msg.sender, address(this), _amount),
            "Volatile token transfer failed"
        );

        // 2. Approve Swap Router to spend volatile token
        IERC20(_volatileToken).approve(address(swapRouter), _amount);

        // 3. Setup Swap parameters (Uniswap V3 ExactInputSingle)
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: _volatileToken,
            tokenOut: address(usdcToken),
            fee: 3000, // 0.3% pool fee tier
            recipient: _recipientClubWallet,
            deadline: block.timestamp + 15 minutes,
            amountIn: _amount,
            amountOutMinimum: 0, // Slippage parameter (0 for simulation)
            sqrtPriceLimitX96: 0
        });

        // 4. Execute atomic swap on DEX
        uint256 amountOut = swapRouter.exactInputSingle(params);

        emit DonationRouted(msg.sender, _recipientClubWallet, _volatileToken, _amount, amountOut);
        return amountOut;
    }
}

const { expect } = require("chai");
const { BigNumber } = require("ethers");
const { arrayify, parseEther } = require("ethers/lib/utils");
const { ethers } = require("hardhat");

describe("MetaTokenTransfer", function () {
  it("Transfering Tokens without gas fee", async function () {
    
    // Deploying Random Token Contract
    const RandomTokenFactory = await ethers.getContractFactory("RandomToken");
    const randomTokenContract = await RandomTokenFactory.deploy();
    await randomTokenContract.deployed();
    // Deploying Meta token sender contract
    const MetaTokenSenderFactory = await ethers.getContractFactory("TokenSender");
    const tokenSenderContract = await MetaTokenSenderFactory.deploy();
    await tokenSenderContract.deployed();

    // Will need three addresses for the testing
    const [_, userAddress, relayerAddress, recipientAddress] =
      await ethers.getSigners();

    // Minting  10,000 tokens to user address (for testing) could be any amount
    const tenThousandTokensWithDecimals = parseEther("10000");
    const userTokenContractInstance = randomTokenContract.connect(userAddress);
    const mintTxn = await userTokenContractInstance.freeMint(tenThousandTokensWithDecimals);
    await mintTxn.wait();

    // Infinite approving the contract to spend tokens
    const approveTxn = await userTokenContractInstance.approve(
      tokenSenderContract.address,
      BigNumber.from(
        // This is uint256's max value (2^256 - 1) in hex
        // There are 64 f's in here.
        // 64 digits = 32 bytes = 256 bits = uint256
        "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
      )
    );
    await approveTxn.wait();

    // Have user sign message to transfer 10 tokens to recipient
    const transferAmountOfTokens = parseEther("10");
    const messageHash = await tokenSenderContract.getHash(
      userAddress.address,
      transferAmountOfTokens,
      recipientAddress.address,
      randomTokenContract.address
    );
    const signature = await userAddress.signMessage(arrayify(messageHash));

    // Have the relayer execute the transaction on behalf of the user
    const relayerSenderContractInstance =
      tokenSenderContract.connect(relayerAddress);
    const metaTxn = await relayerSenderContractInstance.transfer(
      userAddress.address,
      transferAmountOfTokens,
      recipientAddress.address,
      randomTokenContract.address,
      signature
    );
    await metaTxn.wait();

    // Check the user's balance decreased, and recipient got 10 tokens
    const userBalance = await randomTokenContract.balanceOf(
      userAddress.address
    );
    const recipientBalance = await randomTokenContract.balanceOf(
      recipientAddress.address
    );

    expect(userBalance.lt(tenThousandTokensWithDecimals)).to.be.true;
    expect(recipientBalance.gt(BigNumber.from(0))).to.be.true;
  });
});
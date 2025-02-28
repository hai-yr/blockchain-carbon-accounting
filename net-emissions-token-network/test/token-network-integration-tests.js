// SPDX-License-Identifier: Apache-2.0
const { expect } = require("chai");
const {
  allTokenTypeId,
  quantity,
  retireAmount,
  transferAmount,
  fromDate,
  thruDate,
  metadata,
  manifest,
  description,
  revertError
} = require("./common.js");
const { ethers } = require("./ethers-provider");

describe("Net Emissions Token Network - Integration tests", function() {

  let contract;
  beforeEach(async () => {
    await deployments.fixture();
    contract = await ethers.getContract('NetEmissionsTokenNetwork');
  });

  it("should define a Renewable Energy Certificate, go through userflow with token", async function() {

    const { deployer, dealer1, dealer2, consumer1, consumer2 } = await getNamedAccounts();

    // register dealer to issue Renewable Energy Certificate
    let registerDealerRec = await contract.registerDealer(dealer1, allTokenTypeId[0]);
    expect(registerDealerRec);
    // register dealer to issue Carbon Emissions Offset
    let registerDealerCeo = await contract.registerDealer(dealer2, allTokenTypeId[1]);
    expect(registerDealerCeo);
    // register dealer to issue Audited Emissions tokens
    let registerDealerAea = await contract.registerDealer(dealer2, allTokenTypeId[2]);
    expect(registerDealerAea);

    let registerConsumer = await contract.connect(await ethers.getSigner(dealer1)).registerConsumer(consumer1);
    expect(registerConsumer);
    let registerConsumerTwo = await contract.connect(await ethers.getSigner(dealer1)).registerConsumer(consumer2);
    expect(registerConsumerTwo);

    // verify only dealer can issue Renewable Energy Certificate tokens.  Dealer or any consumer issuing would fail.
    let issue = await contract
      .connect(await ethers.getSigner(dealer1))
      .issue(
        dealer1, 
        consumer1,
        allTokenTypeId[0],
        quantity,
        fromDate,
        thruDate,
        metadata,
        manifest,
        description
      );
    // Check to be certain mint did not return errors
    expect(issue);

    try {
      let issueWithDealerTwo = await contract
        .connect(await ethers.getSigner(dealer2))
        .issue(
          dealer1,
          consumer1,
          allTokenTypeId[0],
          quantity,
          fromDate,
          thruDate,
          metadata,
          manifest,
          description
        );
    } catch (err) {
      expect(err.toString()).to.equal(
        revertError("CLM8::_issue: issuer not a registered REC dealer")
      );
    }

    try {
      let issueWithConsumer = await contract
        .connect(await ethers.getSigner(consumer1))
        .issue(
          dealer1,
          consumer1,
          allTokenTypeId[0],
          quantity,
          fromDate,
          thruDate,
          metadata,
          manifest,
          description
        );
    } catch (err) {
      expect(err.toString()).to.equal(revertError("CLM8::onlyDealer: msg.sender not a dealer"));
    }

    // Get ID of token just issued
    let transactionReceipt = await issue.wait(0);
    let issueEvent = transactionReceipt.events.pop();
    let tokenId = issueEvent.args[2].toNumber();
    expect(tokenId).to.equal(1);

    // Get available/retire balance before transfer
    let expectedTotalAvailableBefore = quantity.toString();
    let expectedTotalRetiredBefore = "0";
    let beforeTransferBalanceAmount = await contract
      .getAvailableAndRetired(consumer1, tokenId)
      .then((response) =>
        expect(response.toString()).to.equal(`${expectedTotalAvailableBefore},${expectedTotalRetiredBefore}`)
      );

    // TODO: define a function to get all properties of a token for this test
    let definedTokenType = await contract.getTokenType(tokenId);
    expect(definedTokenType).to.equal("Renewable Energy Certificate");

    // try to transfer balance greater than the available balance
    try {
      let transferFail = await contract.transfer(consumer1, tokenId, quantity + 1);
    } catch (err) {
      expect(err.toString()).to.equal(
        revertError("ERC1155: insufficient balance for transfer")
      );
    }

    // transfer part of balance to another consumer
    let transfer = await contract
      .connect(await ethers.getSigner(consumer1))
      .transfer(consumer2, tokenId, transferAmount);
    expect(transfer);

    // verify available balance after transfer for consumer one
    let expectedTotalAvailableAfterTransfer = (quantity - transferAmount).toString();
    let afterTransferBalances = await contract
      .balanceOf(consumer1, tokenId)
      .then((response) => expect(response.toString()).to.equal(expectedTotalAvailableAfterTransfer));

    // verify balances after transfer for consumer two
    let expectedTotalAvailableAfterTransferConsumerTwo = transferAmount.toString();
    let afterTransferBalancesConsumerTwo = await contract
      .balanceOf(consumer2, tokenId)
      .then((response) => expect(response.toString()).to.equal(expectedTotalAvailableAfterTransferConsumerTwo));

    // retire part of the balance
     let retire = await contract.connect(await ethers.getSigner(consumer1)).retire(tokenId, retireAmount);

    // verify balances after retiring.  The available to transfer balance should be reduced and retired balance is increased
    let expectedTotalAvailableAfterRetire = (transferAmount - retireAmount).toString();
    let expectedTotalRetireAfterRetire = retireAmount.toString();
    let afterRetireAndTransferBalance = await contract
      .getAvailableAndRetired(consumer1, tokenId)
      .then((response) =>
        expect(response.toString()).to.equal(`${expectedTotalAvailableAfterRetire},${expectedTotalRetireAfterRetire}`)
      );

    // test to make sure retired token balance cannot be transferred
    try {
      let transferRetired = await contract.transfer(consumer1, tokenId, quantity);
    } catch (err) {
      expect(err.toString()).to.equal(
        revertError("ERC1155: insufficient balance for transfer")
      );
    }

    // issue more tokens to the same consumer
    let issueTwo = await contract
      .connect(await ethers.getSigner(dealer1))
      .issue(
        dealer1,
        consumer1,
        allTokenTypeId[0],
        quantity,
        fromDate,
        thruDate,
        metadata,
        manifest,
        description
      );

    // retire some of the newly issued tokens

    let retireTwo = await contract.connect(await ethers.getSigner(consumer1)).retire(tokenId + 1, retireAmount);
    //let retireThree = await contract.connect(await ethers.getSigner(consumer1)).retire(tokenId + 2, retireAmount);

    // get total balances of newly issued/retired tokens.  It should correctly return both the available and retired balances the tokens.
    let expectedAvailableTwo = (quantity - retireAmount).toString();
    let expectedRetireTwo = retireAmount.toString();
    let afterRetireTwo = await contract
      .getAvailableAndRetired(consumer1, tokenId + 1)
      .then((response) => expect(response.toString()).to.equal(`${expectedAvailableTwo},${expectedRetireTwo}`));

    /*let expectedAvailableThree = (quantity - retireAmount).toString();
    let expectedRetireThree = retireAmount.toString();
    let afterRetireThree = await contract
      .getAvailableAndRetired(consumer1, tokenId + 2)
      .then((response) => expect(response.toString()).to.equal(`${expectedAvailableThree},${expectedRetireThree}`));
    */
    let unregisterConsumer = await contract.connect(await ethers.getSigner(dealer1)).unregisterConsumer(consumer1);
    expect(unregisterConsumer);

    let unregisterDealer = await contract
      .connect(await ethers.getSigner(deployer))
      .unregisterDealer(dealer1, allTokenTypeId[0]);
    expect(unregisterDealer);
  });

  it("should define a Carbon Emissions Offset, go through userflow with token", async function() {

    const { deployer, dealer1, dealer2, consumer1, consumer2 } = await getNamedAccounts();

    // register dealer to issue Renewable Energy Certificate
    let registerDealerRec = await contract.registerDealer(dealer2, allTokenTypeId[0]);
    expect(registerDealerRec);
    // register dealer to issue Carbon Emissions Offset
    let registerDealerCeo = await contract.registerDealer(dealer1, allTokenTypeId[1]);
    expect(registerDealerCeo);
    // register dealer to issue Audited Emissions tokens
    let registerDealerAea = await contract.registerDealer(dealer2, allTokenTypeId[2]);
    expect(registerDealerAea);

    let registerConsumer = await contract.connect(await ethers.getSigner(dealer1)).registerConsumer(consumer1);
    expect(registerConsumer);
    let registerConsumerTwo = await contract.connect(await ethers.getSigner(dealer1)).registerConsumer(consumer2);
    expect(registerConsumerTwo);

    // verify only dealer can issue Carbon Emissions Offset tokens.  Dealer or any consumer issuing would fail.
    let issue = await contract
      .connect(await ethers.getSigner(dealer1))
      .issue(
        dealer1,
        consumer1,
        allTokenTypeId[1],
        quantity,
        fromDate,
        thruDate,
        metadata,
        manifest,
        description
      );
    // Check to be certain mint did not return errors
    expect(issue);

    try {
      let issueWithDealerTwo = await contract
        .connect(await ethers.getSigner(dealer2))
        .issue(
          dealer2,
          consumer1,
          allTokenTypeId[1],
          quantity,
          fromDate,
          thruDate,
          metadata,
          manifest,
          description
        );
    } catch (err) {
      expect(err.toString()).to.equal(
        revertError("CLM8::_issue: issuer not a registered offset dealer")
      );
    }

    try {
      let issueWithConsumer = await contract
        .connect(await ethers.getSigner(consumer1))
        .issue(
          dealer1,
          consumer1,
          allTokenTypeId[1],
          quantity,
          fromDate,
          thruDate,
          metadata,
          manifest,
          description
        );
    } catch (err) {
      expect(err.toString()).to.equal(revertError("CLM8::onlyDealer: msg.sender not a dealer"));
    }

    // Get ID of token just issued
    let transactionReceipt = await issue.wait(0);
    let issueEvent = transactionReceipt.events.pop();
    let tokenId = issueEvent.args[2].toNumber();
    expect(tokenId).to.equal(1);

    // Get available/retired balance before transfer
    let expectedTotalAvailableBefore = quantity.toString();
    let expectedTotalRetiredBefore = "0";
    let beforeTransferBalanceAmount = await contract
      .getAvailableAndRetired(consumer1, tokenId)
      .then((response) =>
        expect(response.toString()).to.equal(`${expectedTotalAvailableBefore},${expectedTotalRetiredBefore}`)
      );

    // TODO: define a function to get all properties of a token for this test
    let definedTokenType = await contract.getTokenType(tokenId);
    expect(definedTokenType).to.equal("Carbon Emissions Offset");

    // try to transfer balance greater than the available balance
    try {
      let transferFail = await contract.transfer(consumer1, tokenId, quantity + 1);
    } catch (err) {
      expect(err.toString()).to.equal(
        revertError("ERC1155: insufficient balance for transfer")
      );
    }

    // transfer part of balance to another consumer
    let transfer = await contract
      .connect(await ethers.getSigner(consumer1))
      .transfer(consumer2, tokenId, transferAmount);
    expect(transfer);

    // verify available balance after transfer for consumer one
    let expectedTotalAvailableAfterTransfer = (quantity - transferAmount).toString();
    let afterTransferBalances = await contract
      .balanceOf(consumer1, tokenId)
      .then((response) => expect(response.toString()).to.equal(expectedTotalAvailableAfterTransfer));

    // verify balances after transfer for consumer two
    let expectedTotalAvailableAfterTransferConsumerTwo = transferAmount.toString();
    let afterTransferBalancesConsumerTwo = await contract
      .balanceOf(consumer2, tokenId)
      .then((response) => expect(response.toString()).to.equal(expectedTotalAvailableAfterTransferConsumerTwo));

    // retire part of the balance
    let retire = await contract.connect(await ethers.getSigner(consumer1)).retire(tokenId, retireAmount);

    // verify balances after retiring.  The available to transfer balance should be reduced and retired balance is increased
    let expectedTotalAvailableAfterRetire = (transferAmount - retireAmount).toString();
    let expectedTotalRetireAfterRetire = retireAmount.toString();
    let afterRetireAndTransferBalance = await contract
      .getAvailableAndRetired(consumer1, tokenId)
      .then((response) =>
        expect(response.toString()).to.equal(`${expectedTotalAvailableAfterRetire},${expectedTotalRetireAfterRetire}`)
      );

    // test to make sure retired token cannot be transferred
    try {
      let transferRetired = await contract.transfer(consumer1, tokenId, quantity);
    } catch (err) {
      expect(err.toString()).to.equal(
        revertError("ERC1155: insufficient balance for transfer")
      );
    }

    // issue more tokens to the same consumer
    let issueTwo = await contract
      .connect(await ethers.getSigner(dealer1))
      .issue(
        dealer1,
        consumer1,
        allTokenTypeId[1],
        quantity,
        fromDate,
        thruDate,
        metadata,
        manifest,
        description
      );

    let issueThree = await contract
      .connect(await ethers.getSigner(dealer1))
      .issue(
        dealer1,
        consumer1,
        allTokenTypeId[1],
        quantity,
        fromDate,
        thruDate,
        metadata,
        manifest,
        description
      );

    // retire some of the newly issued tokens

    let retireTwo = await contract.connect(await ethers.getSigner(consumer1)).retire(tokenId + 1, retireAmount);
    let retireThree = await contract.connect(await ethers.getSigner(consumer1)).retire(tokenId + 2, retireAmount);

    // get total balances of newly issued/retired tokens.  It should correctly return both the available and retired balances the tokens.
    let expectedAvailableTwo = (quantity - retireAmount).toString();
    let expectedRetireTwo = retireAmount.toString();
    let afterRetireTwo = await contract
      .getAvailableAndRetired(consumer1, tokenId + 1)
      .then((response) => expect(response.toString()).to.equal(`${expectedAvailableTwo},${expectedRetireTwo}`));

    let expectedAvailableThree = (quantity - retireAmount).toString();
    let expectedRetireThree = retireAmount.toString();
    let afterRetireThree = await contract
      .getAvailableAndRetired(consumer1, tokenId + 2)
      .then((response) => expect(response.toString()).to.equal(`${expectedAvailableThree},${expectedRetireThree}`));

    let unregisterConsumer = await contract.connect(await ethers.getSigner(dealer1)).unregisterConsumer(consumer1);
    expect(unregisterConsumer);

    let unregisterDealer = await contract
      .connect(await ethers.getSigner(deployer))
      .unregisterDealer(dealer1, allTokenTypeId[1]);
    expect(unregisterDealer);
  });

  it("should define an Audited Emissions, go through userflow with token", async function() {

    const { deployer, dealer1, dealer2, consumer1, consumer2 } = await getNamedAccounts();

    // register dealer to issue Renewable Energy Certificate
    let registerDealerRec = await contract.registerDealer(dealer2, allTokenTypeId[0]);
    expect(registerDealerRec);
    // register dealer to issue Carbon Emissions Offset
    let registerDealerCeo = await contract.registerDealer(dealer2, allTokenTypeId[1]);
    expect(registerDealerCeo);
    // register dealer to issue Audited Emissions tokens
    let registerDealerAea = await contract.registerDealer(dealer1, allTokenTypeId[2]);
    expect(registerDealerAea);

    let registerConsumer = await contract.connect(await ethers.getSigner(dealer1)).registerConsumer(consumer1);
    expect(registerConsumer);
    let registerConsumerTwo = await contract.connect(await ethers.getSigner(dealer1)).registerConsumer(consumer2);
    expect(registerConsumerTwo);

    // verify only dealer can issue Audited Emissions tokens.  Dealer or any consumer issuing would fail.
    let issue = await contract
      .connect(await ethers.getSigner(dealer1))
      .issue(
        dealer1,
        consumer1,
        allTokenTypeId[2],
        quantity,
        fromDate,
        thruDate,
        metadata,
        manifest,
        description
      );
    // Check to be certain mint did not return errors
    expect(issue);

    try {
      let issueWithDealerTwo = await contract
        .connect(await ethers.getSigner(dealer2))
        .issue(
          dealer2,
          consumer1,
          allTokenTypeId[2],
          quantity,
          fromDate,
          thruDate,
          metadata,
          manifest,
          description
        );
    } catch (err) {
      expect(err.toString()).to.equal(
        revertError("CLM8::_issue: issuer not a registered emissions auditor")
      );
    }

    try {
      let issueWithConsumer = await contract
        .connect(await ethers.getSigner(consumer1))
        .issue(
          dealer2,
          consumer1,
          allTokenTypeId[2],
          quantity,
          fromDate,
          thruDate,
          metadata,
          manifest,
          description
        );
    } catch (err) {
      expect(err.toString()).to.equal(revertError("CLM8::onlyDealer: msg.sender not a dealer"));
    }

    // Get ID of token just issued
    let transactionReceipt = await issue.wait(0);
    let issueEvent = transactionReceipt.events.pop();
    let tokenId = issueEvent.args[2].toNumber();
    expect(tokenId).to.equal(1);

    // Get available/retire balance
    let expectedAvailable = "0";
    let expectedRetire = quantity.toString();
    let available = await contract
      .getAvailableAndRetired(consumer1, tokenId)
      .then((response) => expect(response.toString()).to.equal(`${expectedAvailable},${expectedRetire}`));

    // TODO: define a function to get all properties of a token for this test
    let definedTokenType = await contract.getTokenType(tokenId);
    expect(definedTokenType).to.equal("Audited Emissions");

    // try to transfer the Audited Emissions token to another consumer, verify that it fails
    try {
      let transferRetired = await contract.transfer(consumer1, tokenId, quantity);
    } catch (err) {
      expect(err.toString()).to.equal(
        revertError("ERC1155: insufficient balance for transfer")
      );
    }

    // issue more tokens to the same consumer
    let issueTwo = await contract
      .connect(await ethers.getSigner(dealer1))
      .issue(
        dealer1,
        consumer1,
        allTokenTypeId[2],
        quantity,
        fromDate,
        thruDate,
        metadata,
        manifest,
        description
      );

    let issueThree = await contract
      .connect(await ethers.getSigner(dealer1))
      .issue(
        dealer2,
        consumer1,
        allTokenTypeId[2],
        quantity,
        fromDate,
        thruDate,
        metadata,
        manifest,
        description
      );

    // get total balance of tokens of this type.  It should correctly return both the available and retired balances from all the tokens.
    let expectedAvailableTwo = "0";
    let expectedRetireTwo = quantity.toString();
    let afterRetireTwo = await contract
      .getAvailableAndRetired(consumer1, tokenId + 1)
      .then((response) => expect(response.toString()).to.equal(`${expectedAvailableTwo},${expectedRetireTwo}`));

    let expectedAvailableThree = "0";
    let expectedRetireThree = quantity.toString();
    let afterRetireThree = await contract
      .getAvailableAndRetired(consumer1, tokenId + 2)
      .then((response) => expect(response.toString()).to.equal(`${expectedAvailableThree},${expectedRetireThree}`));

    let unregisterConsumer = await contract.connect(await ethers.getSigner(dealer1)).unregisterConsumer(consumer1);
    expect(unregisterConsumer);

    let unregisterDealer = await contract
      .connect(await ethers.getSigner(deployer))
      .unregisterDealer(dealer1, allTokenTypeId[2]);
    expect(unregisterDealer);
  });

  it("should define a Carbon Token, go through userflow with token", async function() {

    const { deployer, dealer1, dealer2, consumer1, consumer2, industry1, industry2 } = await getNamedAccounts();

    // register Industry (as admin REGISTERED_DEALER)
    let registerDealerInd = await contract.registerDealer(industry1, allTokenTypeId[3]);
    expect(registerDealerInd);
    // industry1 to register industry2 (not admin authorized REGISTERED_DEALER )
    let registerIndustryTwo = await contract.connect(await ethers.getSigner(industry1)).registerIndustry(industry2);
    expect(registerIndustryTwo);

    // register dealer to issue carbon tokens
    let registerDealerAea = await contract.registerDealer(dealer1, allTokenTypeId[2]);
    expect(registerDealerAea);

    let registerConsumer = await contract.connect(await ethers.getSigner(industry1)).registerConsumer(consumer1);
    expect(registerConsumer);

    try {
      await contract
        .connect(await ethers.getSigner(industry1))
        .registerConsumer(consumer1);
    } catch (err) {
      expect(err.toString()).to.equal(revertError("CLM8::onlyDealer: msg.sender not a dealer"));
    }

    let registerConsumerTwo = await contract.connect(await ethers.getSigner(industry1)).registerConsumer(consumer2);
    expect(registerConsumerTwo);

    // verify only industry can issue carbon tokens.  Dealer or any consumer issuing would fail.
    let issue = await contract
      .connect(await ethers.getSigner(industry1))
      .issue(
        industry1,
        industry1,
        allTokenTypeId[3],
        quantity,
        fromDate,
        thruDate,
        metadata,
        manifest,
        description
      );
    // Check to be certain mint did not return errors
    expect(issue);


    try {
      let issueWithConsumer = await contract
        .connect(await ethers.getSigner(consumer1))
        .issue(
          industry1,
          industry1,
          allTokenTypeId[3],
          quantity,
          fromDate,
          thruDate,
          metadata,
          manifest,
          description
        );
    } catch (err) {
      expect(err.toString()).to.equal(revertError("CLM8::onlyDealer: msg.sender not a dealer"));
    }

    try {
      let issueWithIndustryTwo = await contract
        .connect(await ethers.getSigner(industry2))
        .issue(
          industry2,
          industry1,
          allTokenTypeId[3],
          quantity,
          fromDate,
          thruDate,
          metadata,
          manifest,
          description
        );
    } catch (err) {
      expect(err.toString()).to.equal(
        revertError("CLM8::_issue: registered industry can only issue carbon to itself")
      );
    }

    try {
      let issueWithAe = await contract
        .connect(await ethers.getSigner(dealer1))
        .issue(
          dealer1,
          dealer1,
          allTokenTypeId[3],
          quantity,
          fromDate,
          thruDate,
          metadata,
          manifest,
          description
        );
    } catch (err) {
      expect(err.toString()).to.equal(revertError("CLM8::_issue: issuer not a registered industry"));
    }

    // Get ID of token just issued
    let transactionReceipt = await issue.wait(0);
    let issueEvent = transactionReceipt.events.pop();
    let tokenId = issueEvent.args[2].toNumber();
    expect(tokenId).to.equal(1);

    // Get available/retire balance
    let expectedAvailable = quantity.toString();
    let expectedRetire = "0";
    let available = await contract
      .getAvailableAndRetired(industry1, tokenId)
      .then((response) => expect(response.toString()).to.equal(`${expectedAvailable},${expectedRetire}`));

    // TODO: define a function to get all properties of a token for this test
    let definedTokenType = await contract.getTokenType(tokenId);
    expect(definedTokenType).to.equal("Carbon Tracker");

    // verify transfer to industry2 with approval signature.
    let msg = await contract.getTransferHash(industry1, industry2, [tokenId], [transferAmount]);
    msg = ethers.utils.arrayify(msg)
    let signer = await ethers.getSigner(industry2);
    let signature = await signer.signMessage(msg);

    let transfer = await contract
      .connect(await ethers.getSigner(industry1))
      .safeTransferFrom(industry1, industry2, tokenId, transferAmount, signature);
    expect(transfer);
    
    /*
    // Drop this test as we no longer require recieving party approval to transfer tracker tokens
    // Assume that their in an inhenet value in holding volunrary tracker tokens linked to an emission profile

    // try to transfer carbon tokens again, verify that it fails with approval signature is not valid
    try {
      await contract
        .connect(await ethers.getSigner(industry1))
        .safeTransferFrom(industry1, industry2, tokenId, transferAmount,signature);
    } catch (err) {
      expect(err.toString()).to.equal(
        revertError("CLM8::_beforeTokenTransfer: receiver's approval signature is not valid")
      );
    }
    */
    
    // try to transfer carbon tokens again, verify that it fails with insufficient balance
    msg = await contract.getTransferHash(industry1, industry2, [tokenId], [quantity]);
    msg = ethers.utils.arrayify(msg);
    signature = await signer.signMessage(msg);
    try {
      let transfer2 = await contract
        .connect(await ethers.getSigner(industry1))
        .safeTransferFrom(industry1, industry2, tokenId, quantity,signature);
    } catch (err) {
      expect(err.toString()).to.equal(
        revertError("ERC1155: insufficient balance for transfer")
      );
    }

    // retire part of the balance
    let retire = await contract.connect(await ethers.getSigner(industry1)).retire(tokenId, retireAmount);
    let event = (await retire.wait(0)).events[0];
    
    // verify balances after retiring.  The available to transfer balance should be reduced and retired balance is increased
    let expectedTotalAvailableAfterRetire = (transferAmount - retireAmount).toString();
    let expectedTotalRetireAfterRetire = retireAmount.toString();
    let afterRetireAndTransferBalance = await contract
      .getAvailableAndRetired(industry1, tokenId)
      .then((response) =>
        expect(response.toString()).to.equal(`${expectedTotalAvailableAfterRetire},${expectedTotalRetireAfterRetire}`)
      );

    // test to make sure retired token balance cannot be transferred
    try {
      let transferRetired = await contract
        .connect(await ethers.getSigner(industry1))
        .retire(tokenId, quantity);
    } catch (err) {
      expect(err.toString()).to.equal(
        revertError("CLM8::retire: not enough available balance to retire")
      );
    }

    let unregisterDealer = await contract
      .connect(await ethers.getSigner(deployer))
      .unregisterDealer(industry1, allTokenTypeId[3]);
    expect(unregisterDealer);
    
  });
});

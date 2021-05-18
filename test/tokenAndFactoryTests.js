const MoldSecurityToken = artifacts.require('MoldSecurityToken');
const MoldSecurityFactory = artifacts.require('MoldSecurityFactory');
const ERC20Mock = artifacts.require('ERC20Mock');
const {signERC2612Permit} = require('eth-permit');
const TestTransferReceiver = artifacts.require('TestTransferReceiver');

const {BN, expectRevert} = require('@openzeppelin/test-helpers');
const {web3} = require('@openzeppelin/test-helpers/src/setup');
require('chai').use(require('chai-as-promised')).should();

const MAX = '115792089237316195423570985008687907853269984665640564039457584007913129639935';

function bn(number) {
  return new BN(number);
}


const mineBlock = require('./helpers/ganacheTimeTraveler');

const mine3Blocks = async () => {
  for (let i = 0; i < 3; i++) {
    await mineBlock(1);
  }
};

contract('MoldSecurityToken', (accounts) => {
  const [user1, user2, user3] = accounts;
  let moldSecurityToken;
  let moldSecurityFactory;

  let tokenToMold;

  beforeEach(async () => {
    await mineBlock(1);

    tokenToMold = await ERC20Mock.new();

    moldSecurityFactory = await MoldSecurityFactory.new();

    const moldToken = await moldSecurityFactory.deployMoldToken.call(tokenToMold.address);
    await moldSecurityFactory.deployMoldToken(tokenToMold.address);

    moldSecurityToken = await MoldSecurityToken.at(moldToken);
  });

  describe('deployment', async () => {
    it('returns the name', async () => {
      const name = await moldSecurityToken.name();
      name.should.equal('Mold Security Test');
    });

    it('deposits ether', async () => {
      const balanceBefore = await moldSecurityToken.balanceOf(user1);

      await tokenToMold.transfer(user1, 1);
      await tokenToMold.approve(moldSecurityToken.address, 1, {from: user1});

      await moldSecurityToken.deposit(1, {from: user1});
      await mine3Blocks();

      const balanceAfter = await moldSecurityToken.balanceOf(user1);
      balanceAfter.toString().should.equal(balanceBefore.add(new BN('1')).toString());
    });

    it('deposits ether to another account', async () => {
      const balanceBefore = await moldSecurityToken.balanceOf(user2);

      await tokenToMold.transfer(user1, 1);
      await tokenToMold.approve(moldSecurityToken.address, 1, {from: user1});

      await moldSecurityToken.depositTo(user2, 1, {from: user1});
      await mine3Blocks();

      const balanceAfter = await moldSecurityToken.balanceOf(user2);
      balanceAfter.toString().should.equal(balanceBefore.add(new BN('1')).toString());
    });

    it('deposits with depositToAndCall', async () => {
      const receiver = await TestTransferReceiver.new();

      await tokenToMold.transfer(user1, 1);
      await tokenToMold.approve(moldSecurityToken.address, 1, {from: user1});

      await moldSecurityToken.depositToAndCall(receiver.address, 1, '0x11', {from: user1});

      const events = await receiver.getPastEvents();
      events.length.should.equal(1);
      events[0].event.should.equal('TransferReceived');
      events[0].returnValues.token.should.equal(moldSecurityToken.address);
      events[0].returnValues.sender.should.equal(user1);
      events[0].returnValues.value.should.equal('1');
      events[0].returnValues.data.should.equal('0x11');
    });

    describe('with a positive balance', async () => {
      beforeEach(async () => {
        await tokenToMold.transfer(user1, 10);
        await tokenToMold.approve(moldSecurityToken.address, 10, {from: user1});

        await moldSecurityToken.deposit(10, {from: user1});
        await mine3Blocks();
      });

      it('returns the Ether balance as total supply', async () => {
        const totalSupply = await moldSecurityToken.totalSupply();
        totalSupply.toString().should.equal('10');
      });

      it('withdraws ether', async () => {
        const balanceBefore = await moldSecurityToken.balanceOf(user1);
        await moldSecurityToken.withdraw(1, {from: user1});
        const balanceAfter = await moldSecurityToken.balanceOf(user1);
        balanceAfter.toString().should.equal(balanceBefore.sub(new BN('1')).toString());
      });

      it('withdraws ether to another account', async () => {
        const fromBalanceBefore = await moldSecurityToken.balanceOf(user1);
        const toBalanceBefore = new BN(await tokenToMold.balanceOf(user2));

        await moldSecurityToken.withdrawTo(user2, 1, {from: user1});

        const fromBalanceAfter = await moldSecurityToken.balanceOf(user1);
        const toBalanceAfter = new BN(await tokenToMold.balanceOf(user2));

        fromBalanceAfter.toString().should.equal(fromBalanceBefore.sub(new BN('1')).toString());
        toBalanceAfter.toString().should.equal(toBalanceBefore.add(new BN('1')).toString());
      });

      it('should not withdraw beyond balance', async () => {
        await expectRevert(moldSecurityToken.withdraw(100, {from: user1}),
          'MoldSecurityToken: burn amount exceeds balance');
        await expectRevert(moldSecurityToken.withdrawTo(user2, 100, {from: user1}),
          'MoldSecurityToken: burn amount exceeds balance');
        await expectRevert(moldSecurityToken.withdrawFrom(user1, user2, 100, {from: user1}),
          'MoldSecurityToken: burn amount exceeds balance');
      });

      it('transfers', async () => {
        const balanceBefore = await moldSecurityToken.balanceOf(user2);
        await moldSecurityToken.transfer(user2, 1, {from: user1});
        const balanceAfter = await moldSecurityToken.balanceOf(user2);
        balanceAfter.toString().should.equal(balanceBefore.add(new BN('1')).toString());
      });

      it('withdraws by transferring to address(0)', async () => {
        const balanceBefore = await moldSecurityToken.balanceOf(user1);
        await moldSecurityToken.transfer('0x0000000000000000000000000000000000000000',
          1, {from: user1});
        const balanceAfter = await moldSecurityToken.balanceOf(user1);
        balanceAfter.toString().should.equal(balanceBefore.sub(new BN('1')).toString());
      });

      it('transfers using transferFrom', async () => {
        const balanceBefore = await moldSecurityToken.balanceOf(user2);
        await moldSecurityToken.transferFrom(user1, user2, 1, {from: user1});
        const balanceAfter = await moldSecurityToken.balanceOf(user2);
        balanceAfter.toString().should.equal(balanceBefore.add(new BN('1')).toString());
      });

      it('withdraws by transferring from someone to address(0)', async () => {
        const balanceBefore = await moldSecurityToken.balanceOf(user1);
        await moldSecurityToken.transferFrom(user1, '0x0000000000000000000000000000000000000000',
          1, {from: user1});
        const balanceAfter = await moldSecurityToken.balanceOf(user1);
        balanceAfter.toString().should.equal(balanceBefore.sub(new BN('1')).toString());
      });

      it('transfers with transferAndCall', async () => {
        const receiver = await TestTransferReceiver.new();
        await moldSecurityToken.transferAndCall(receiver.address, 1, '0x11', {from: user1});

        const events = await receiver.getPastEvents();
        events.length.should.equal(1);
        events[0].event.should.equal('TransferReceived');
        events[0].returnValues.token.should.equal(moldSecurityToken.address);
        events[0].returnValues.sender.should.equal(user1);
        events[0].returnValues.value.should.equal('1');
        events[0].returnValues.data.should.equal('0x11');
      });

      it('should not transfer and call to zero address', async () => {
        const receiver = '0x0000000000000000000000000000000000000000';
        await expectRevert.unspecified(moldSecurityToken.transferAndCall(receiver, 100, '0x11',
          {from: user1}));
      });

      it('should not transfer beyond balance', async () => {
        await expectRevert(moldSecurityToken.transfer(user2, 100, {from: user1}),
          'MoldSecurityToken: transfer amount exceeds balance');
        await expectRevert(moldSecurityToken.transferFrom(user1, user2, 100, {from: user1}),
          'MoldSecurityToken: transfer amount exceeds balance');
        const receiver = await TestTransferReceiver.new();
        await expectRevert(moldSecurityToken.transferAndCall(receiver.address, 100, '0x11',
          {from: user1}),
        'MoldSecurityToken: transfer amount exceeds balance');
      });

      it('approves to increase allowance', async () => {
        const allowanceBefore = await moldSecurityToken.allowance(user1, user2);
        await moldSecurityToken.approve(user2, 1, {from: user1});
        const allowanceAfter = await moldSecurityToken.allowance(user1, user2);
        allowanceAfter.toString().should.equal(allowanceBefore.add(new BN('1')).toString());
      });

      it('approves with approveAndCall', async () => {
        const receiver = await TestTransferReceiver.new();
        await moldSecurityToken.approveAndCall(receiver.address, 1, '0x11', {from: user1});

        const events = await receiver.getPastEvents();
        events.length.should.equal(1);
        events[0].event.should.equal('ApprovalReceived');
        events[0].returnValues.token.should.equal(moldSecurityToken.address);
        events[0].returnValues.spender.should.equal(user1);
        events[0].returnValues.value.should.equal('1');
        events[0].returnValues.data.should.equal('0x11');
      });

      // Method eth_signTypedData_v4 not supported. ERROR.
      // Looks like somethimg is wrong with ganache using this feature
      it.skip('approves to increase allowance with permit', async () => {
        const permitResult = await signERC2612Permit(web3.currentProvider,
          moldSecurityToken.address, user1, user2, '1');
        await moldSecurityToken.permit(user1, user2, '1', permitResult.deadline,
          permitResult.v, permitResult.r, permitResult.s);
        const allowanceAfter = await moldSecurityToken.allowance(user1, user2);
        allowanceAfter.toString().should.equal('1');
      });

      it.skip('does not approve with expired permit', async () => {
        const permitResult = await signERC2612Permit(web3.currentProvider,
          moldSecurityToken.address, user1, user2, '1');
        await expectRevert(moldSecurityToken.permit(
          user1, user2, '1', 0, permitResult.v, permitResult.r, permitResult.s),
        'MoldSecurityToken: Expired permit',
        );
      });

      // Method eth_signTypedData_v4 not supported. ERROR.
      // Looks like somethimg is wrong with ganache using this feature
      it.skip('does not approve with invalid permit', async () => {
        const permitResult = await signERC2612Permit(web3.currentProvider,
          moldSecurityToken.address, user1, user2, '1');
        await expectRevert(
          moldSecurityToken.permit(user1, user2, '2', permitResult.deadline,
            permitResult.v, permitResult.r, permitResult.s),
          'MoldSecurityToken: invalid permit',
        );
      });

      describe('with a positive allowance', async () => {
        beforeEach(async () => {
          await moldSecurityToken.approve(user2, 1, {from: user1});
        });

        it('transfers using transferFrom and allowance', async () => {
          const balanceBefore = await moldSecurityToken.balanceOf(user2);
          await moldSecurityToken.transferFrom(user1, user2, 1, {from: user2});
          const balanceAfter = await moldSecurityToken.balanceOf(user2);
          balanceAfter.toString().should.equal(balanceBefore.add(new BN('1')).toString());
        });

        it('should not transfer beyond allowance', async () => {
          await expectRevert(moldSecurityToken.transferFrom(user1, user2, 2, {from: user2}),
            'MoldSecurityToken: request exceeds allowance');
        });

        it('withdraws ether using withdrawFrom and allowance', async () => {
          const fromBalanceBefore = await moldSecurityToken.balanceOf(user1);
          const toBalanceBefore = new BN(await tokenToMold.balanceOf(user3));

          await moldSecurityToken.withdrawFrom(user1, user3, 1, {from: user2});

          const fromBalanceAfter = await moldSecurityToken.balanceOf(user1);
          const toBalanceAfter = new BN(await tokenToMold.balanceOf(user3));

          fromBalanceAfter.toString().should.equal(fromBalanceBefore.sub(new BN('1')).toString());
          toBalanceAfter.toString().should.equal(toBalanceBefore.add(new BN('1')).toString());
        });

        it('should not withdraw beyond allowance', async () => {
          await expectRevert(moldSecurityToken.withdrawFrom(user1, user3, 2, {from: user2}),
            'MoldSecurityToken: request exceeds allowance');
        });
      });

      describe('with a maximum allowance', async () => {
        beforeEach(async () => {
          await moldSecurityToken.approve(user2, MAX, {from: user1});
        });

        it('does not decrease allowance using transferFrom', async () => {
          await moldSecurityToken.transferFrom(user1, user2, 1, {from: user2});
          const allowanceAfter = await moldSecurityToken.allowance(user1, user2);
          allowanceAfter.toString().should.equal(MAX);
        });

        it('does not decrease allowance using withdrawFrom', async () => {
          await moldSecurityToken.withdrawFrom(user1, user2, 1, {from: user2});
          const allowanceAfter = await moldSecurityToken.allowance(user1, user2);
          allowanceAfter.toString().should.equal(MAX);
        });
      });
    });

    describe('mold suecurity feaure', async () => {
      it('should be possible to transfer mold tokens from receiver address after 2 blocks passes', async () => {
        await tokenToMold.transfer(user1, 100);
        await tokenToMold.approve(moldSecurityToken.address, 100, {from: user1});
        await moldSecurityToken.deposit(100, {from: user1});
        await mine3Blocks();

        await moldSecurityToken.transfer(user2, 25, {from: user1});
        await moldSecurityToken.transfer(user2, 50, {from: user1});

        assert.equal(bn(await moldSecurityToken.balanceOf(user1)).toString(), bn(25).toString());
        assert.equal(bn(await moldSecurityToken.balanceOf(user2)).toString(), bn(75).toString());

        await mine3Blocks();

        await moldSecurityToken.transfer(user1, 25, {from: user2});
        await moldSecurityToken.transfer(user3, 25, {from: user2});

        assert.equal(bn(await moldSecurityToken.balanceOf(user1)).toString(), bn(50).toString());
        assert.equal(bn(await moldSecurityToken.balanceOf(user2)).toString(), bn(25).toString());
        assert.equal(bn(await moldSecurityToken.balanceOf(user3)).toString(), bn(25).toString());
      });
      it('should not be possible to transfer mold tokens in the same block of receiving them', async () => {
        await tokenToMold.transfer(user1, 100);
        await tokenToMold.approve(moldSecurityToken.address, 100, {from: user1});
        await moldSecurityToken.deposit(100, {from: user1});
        await mine3Blocks();

        await moldSecurityToken.transfer(user2, 25, {from: user1});
        await moldSecurityToken.transfer(user2, 50, {from: user1});

        assert.equal(bn(await moldSecurityToken.balanceOf(user1)).toString(), bn(25).toString());
        assert.equal(bn(await moldSecurityToken.balanceOf(user2)).toString(), bn(75).toString());
        assert.equal(bn(await moldSecurityToken.balanceOf(user3)).toString(), bn(0).toString());

        await expectRevert(moldSecurityToken.transfer(user1, 25, {from: user2}),
          'MoldSecurityToken: not enough blocks passed from previous transfer');
        await expectRevert(moldSecurityToken.transfer(user3, 25, {from: user2}),
          'MoldSecurityToken: not enough blocks passed from previous transfer');

        assert.equal(bn(await moldSecurityToken.balanceOf(user1)).toString(), bn(25).toString());
        assert.equal(bn(await moldSecurityToken.balanceOf(user2)).toString(), bn(75).toString());
        assert.equal(bn(await moldSecurityToken.balanceOf(user3)).toString(), bn(0).toString());
      });

      it('should not be possible to transfer mold tokens withing 2 blocks from receiving them', async () => {
        await tokenToMold.transfer(user1, 100);
        await tokenToMold.approve(moldSecurityToken.address, 100, {from: user1});
        await moldSecurityToken.deposit(100, {from: user1});
        await mine3Blocks();

        await moldSecurityToken.transfer(user2, 25, {from: user1});
        await moldSecurityToken.transfer(user2, 50, {from: user1});

        await mineBlock();

        assert.equal(bn(await moldSecurityToken.balanceOf(user1)).toString(), bn(25).toString());
        assert.equal(bn(await moldSecurityToken.balanceOf(user2)).toString(), bn(75).toString());

        await expectRevert(moldSecurityToken.transfer(user1, 25, {from: user2}),
          'MoldSecurityToken: not enough blocks passed from previous transfer');

        assert.equal(bn(await moldSecurityToken.balanceOf(user1)).toString(), bn(25).toString());
        assert.equal(bn(await moldSecurityToken.balanceOf(user2)).toString(), bn(75).toString());
      });

      it('should be possible to transferFrom mold tokens from receiver address after 2 blocks passes', async () => {
        await tokenToMold.transfer(user1, 100);
        await tokenToMold.approve(moldSecurityToken.address, 100, {from: user1});
        await moldSecurityToken.deposit(100, {from: user1});
        await mine3Blocks();

        await moldSecurityToken.approve(user3, 100, {from: user1});

        await moldSecurityToken.transferFrom(user1, user2, 25, {from: user3});
        await moldSecurityToken.transferFrom(user1, user2, 50, {from: user3});

        assert.equal(bn(await moldSecurityToken.balanceOf(user1)).toString(), bn(25).toString());
        assert.equal(bn(await moldSecurityToken.balanceOf(user2)).toString(), bn(75).toString());

        await mine3Blocks();

        await moldSecurityToken.approve(user3, 75, {from: user2});

        await moldSecurityToken.transferFrom(user2, user1, 25, {from: user3});
        await moldSecurityToken.transferFrom(user2, user3, 25, {from: user3});

        assert.equal(bn(await moldSecurityToken.balanceOf(user1)).toString(), bn(50).toString());
        assert.equal(bn(await moldSecurityToken.balanceOf(user2)).toString(), bn(25).toString());
        assert.equal(bn(await moldSecurityToken.balanceOf(user3)).toString(), bn(25).toString());
      });
      it('should not be possible to transfer mold tokens in the same block of receiving them', async () => {
        await tokenToMold.transfer(user1, 100);
        await tokenToMold.approve(moldSecurityToken.address, 100, {from: user1});
        await moldSecurityToken.deposit(100, {from: user1});
        await mine3Blocks();

        await moldSecurityToken.approve(user3, 100, {from: user1});

        await moldSecurityToken.transferFrom(user1, user2, 25, {from: user3});
        await moldSecurityToken.transferFrom(user1, user2, 50, {from: user3});

        assert.equal(bn(await moldSecurityToken.balanceOf(user1)).toString(), bn(25).toString());
        assert.equal(bn(await moldSecurityToken.balanceOf(user2)).toString(), bn(75).toString());

        await moldSecurityToken.approve(user3, 75, {from: user2});

        await expectRevert(moldSecurityToken.transferFrom(user2, user1, 25, {from: user3}),
          'MoldSecurityToken: not enough blocks passed from previous transfer');

        assert.equal(bn(await moldSecurityToken.balanceOf(user1)).toString(), bn(25).toString());
        assert.equal(bn(await moldSecurityToken.balanceOf(user2)).toString(), bn(75).toString());
      });

      it('should be possible to transferAndCall mold tokens from receiver address after 2 blocks passes', async () => {
        const receiver = await TestTransferReceiver.new();

        await tokenToMold.transfer(user1, 100);
        await tokenToMold.approve(moldSecurityToken.address, 100, {from: user1});
        await moldSecurityToken.deposit(100, {from: user1});
        await mine3Blocks();

        await moldSecurityToken.transferAndCall(receiver.address, 25, '0x11', {from: user1});
        await moldSecurityToken.transferAndCall(receiver.address, 50, '0x11', {from: user1});

        assert.equal(bn(await moldSecurityToken.balanceOf(user1)).toString(), bn(25).toString());
        assert.equal(bn(await moldSecurityToken.balanceOf(receiver.address)).toString(),
          bn(75).toString());

        await mine3Blocks();

        await receiver.transfer(moldSecurityToken.address, user1, 25);
        await receiver.transfer(moldSecurityToken.address, user3, 25);

        assert.equal(bn(await moldSecurityToken.balanceOf(user1)).toString(), bn(50).toString());
        assert.equal(bn(await moldSecurityToken.balanceOf(receiver.address)).toString(),
          bn(25).toString());
        assert.equal(bn(await moldSecurityToken.balanceOf(user3)).toString(), bn(25).toString());
      });

      it('should not be possible to transferAndCall mold tokens withing 2 blocks from receiving them', async () => {
        const receiver = await TestTransferReceiver.new();

        await tokenToMold.transfer(user1, 100);
        await tokenToMold.approve(moldSecurityToken.address, 100, {from: user1});
        await moldSecurityToken.deposit(100, {from: user1});
        await mine3Blocks();

        await moldSecurityToken.transferAndCall(receiver.address, 25, '0x11', {from: user1});
        await moldSecurityToken.transferAndCall(receiver.address, 50, '0x11', {from: user1});

        await mineBlock();

        assert.equal(bn(await moldSecurityToken.balanceOf(user1)).toString(), bn(25).toString());
        assert.equal(bn(await moldSecurityToken.balanceOf(receiver.address)).toString(),
          bn(75).toString());

        await expectRevert(receiver.transfer(moldSecurityToken.address, user1, 25),
          'MoldSecurityToken: not enough blocks passed from previous transfer');

        assert.equal(bn(await moldSecurityToken.balanceOf(user1)).toString(), bn(25).toString());
        assert.equal(bn(await moldSecurityToken.balanceOf(receiver.address)).toString(),
          bn(75).toString());
      });
    });
    describe('factory', async () => {
      it('should be possible to deploy new mold token with factory', async () => {
        newTokenToMold = await ERC20Mock.new();

        const moldToken = await moldSecurityFactory.deployMoldToken.call(newTokenToMold.address);
        const moldToken2 = await moldSecurityFactory.deployMoldToken.call(newTokenToMold.address);

        await moldSecurityFactory.deployMoldToken(newTokenToMold.address);

        assert.equal(moldToken, moldToken2);
      });

      it('should not be possible to deploy mold token for covered one', async () => {
        newTokenToMold = await ERC20Mock.new();

        await moldSecurityFactory.deployMoldToken(newTokenToMold.address);
        await expectRevert.unspecified(moldSecurityFactory.deployMoldToken(newTokenToMold.address));
      });

      it('should not be possible to mold already mold token', async () => {
        newTokenToMold = await ERC20Mock.new();

        const moldToken = await moldSecurityFactory.deployMoldToken.call(newTokenToMold.address);
        await moldSecurityFactory.deployMoldToken(newTokenToMold.address);

        await expectRevert(moldSecurityFactory.deployMoldToken(moldToken),
          'MoldSecurityFactory: Attemt to mold already mold token');
      });
    });
  });
});

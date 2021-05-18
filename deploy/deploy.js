const MoldSecurityToken = artifacts.require('MoldSecurityToken');
const MoldSecurityFactory = artifacts.require('MoldSecurityFactory');

contract('deploy', (accounts) => {
  let moldSecurityFactory;
  describe('', async () => {
    it('', async () => {
      const tokenToMold = '0x07865c6E87B9F70255377e024ace6630C1Eaa37F';

      moldSecurityFactory = await MoldSecurityFactory.new();

      const moldToken = await moldSecurityFactory.deployMoldToken.call(tokenToMold);
      console.log(moldToken);
      await moldSecurityFactory.deployMoldToken(tokenToMold);
    })
  });
});
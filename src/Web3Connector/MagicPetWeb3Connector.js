/* global window */
import { ethers } from 'ethers';
import AbstractWeb3Connector from './AbstractWeb3Connector';

export default class MagicPetWeb3Connector extends AbstractWeb3Connector {
  type = 'MagicPetLink';
  async activate({ userAuthMethod, apiKey, network, newSession } = {}) {
    let magic = null;
    let ether = null;

    if (!userAuthMethod.type) {
      throw new Error('"email" not provided, please provide Email');
    }
    if (!apiKey) {
      throw new Error('"apiKey" not provided, please provide Api Key');
    }
    if (!network) {
      throw new Error('"network" not provided, please provide network');
    }

    let Magic;
    try {
      Magic = require('magic-sdk')?.Magic;
    } catch (error) {
      // Do nothing. User might not need walletconnect
    }

    if (!Magic) {
      Magic = window?.Magic;
    }

    if (!Magic) {
      throw new Error('Cannot enable via MagicLink: dependency "magic-sdk" is missing');
    }

    try {
      magic = new Magic(apiKey, {
        network: network,
      });

      if (newSession) {
        if (magic?.user) {
          try {
            await magic?.user?.logout();
          } catch (error) {
            // Do nothing
          }
        }
      }

      ether = new ethers.providers.Web3Provider(magic.rpcProvider);

      if (userAuthMethod.type === 'email') {
        // Trigger Magic link to be sent to user
        await magic.auth.loginWithMagicLink({
          email: userAuthMethod.input,
        });
      } else if (userAuthMethod.type === 'phone') {
        await magic.auth.loginWithSMS({
          phoneNumber: userAuthMethod.input,
        });
      } else if (userAuthMethod.type === 'social') {
        await magic.oauth.loginWithRedirect({
          provider: userAuthMethod.input,
          redirectURI: new URL('/profile', window.location.origin).href,
        });
      }
    } catch (err) {
      throw new Error('Error during enable via MagicLink, please double check network and apikey');
    }

    const loggedIn = await magic.user.isLoggedIn();
    if (loggedIn) {
      const signer = ether.getSigner();
      const { chainId } = await ether.getNetwork();
      const address = (await signer.getAddress()).toLowerCase();
      // Assign Constants
      this.account = address;
      this.provider = ether.provider;
      this.chainId = `0x${chainId.toString(16)}`;
      // Assign magic user for deactivation
      this.magicUser = magic;
      this.subscribeToEvents(this.provider);
      return {
        provider: this.provider,
        account: this.account,
        chainId: this.chainId,
      };
    }
    throw new Error('Error during enable via MagicLink, login to magic failed');
  }

  deactivate = async () => {
    this.unsubscribeToEvents(this.provider);
    if (this.magicUser) {
      await this.magicUser.user.logout();
    }
    this.account = null;
    this.chainId = null;
    this.provider = null;
  };
}

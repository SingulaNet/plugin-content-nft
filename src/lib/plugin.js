'use strict'

const debug = require('debug')('plugin-content-nft');
const EventEmitter2 = require('eventemitter2').EventEmitter2;
const { Web3, WebSocketProvider } = require('web3');
const LegacyTransaction = require('@ethereumjs/tx').LegacyTransaction;
const { Common, Chain, Hardfork } = require('@ethereumjs/common');
const common = Common.custom({
  chainId: 11421,
  hardfork: "petersburg",
});
const abi = require('../abi/ContentNft.json');

class PluginContentNft extends EventEmitter2 {
  constructor(opts) {
    console.log(opts);
    super();
    this._primaryProvider = opts.provider;
    this._secondaryProvider = opts.altProvider || opts.provider;
    this.provider = this._primaryProvider;
    this.contractAddress = opts.contractAddress;
    this.web3 = null;
    this.healthCheck = false;
  }

  async connect() {
    debug(`connect... ${this.provider}`);

    if (!this.healthCheck) {
      this._heartbeat();
    }
    this.healthCheck = true;

    const provider = new WebSocketProvider(this.provider);
    this.web3 = new Web3(provider);

    this.web3.eth.handleRevert = true;
    this.contract = new this.web3.eth.Contract(abi, this.contractAddress);
    this.web3.eth.transactionBlockTimeout = 20000;

    debug('registering DesignLog event handler');
    this.contract.events.DesignLog()
      .on('data', (event) => {
        debug('DesignLog event:');
        debug(event.returnValues);
        this.emit('Design', event.returnValues);
      });

    debug('registering MintLog event handler');
    this.contract.events.MintLog()
      .on('data', (event) => {
        debug('MintLog event:');
        debug(event.returnValues);
        this.emit('Mint', event.returnValues);
      });

    debug('registering TransferLog event handler');
    this.contract.events.Transfer()
      .on('data', (event) => {
        debug('TransferLog event:');
        debug(event.returnValues);
        this.emit('TransferObject', event);
      });
  }

  disconnect() {
    if (!this.web3) return;
    this.web3.currentProvider.disconnect();
    this.web3 = null;
  }

  _heartbeat() {
    setInterval(() => {
      /**
       * Handle web socket disconnects
       * @see https://github.com/ethereum/web3.js/issues/1354
       * @see https://github.com/ethereum/web3.js/issues/1933
       * It also serves as a heartbeat to node
       */
      if (this.web3) {
        this.web3.eth.net.isListening()
          .catch((e) => {
            debug("disconnected " + this.provider);
            this.web3.currentProvider.disconnect();
            this.web3 = null;
            if (this.provider === this._primaryProvider) {
              this.provider = this._secondaryProvider;
            } else {
              this.provider = this._primaryProvider;
            }
            const provider = new WebSocketProvider(this.provider);
            provider.on("connect", () => {
              this.connect();
            })
          })
      }

      // reconnect
      if (!this.web3) {
        if (this.provider === this._primaryProvider) {
          this.provider = this._secondaryProvider;
        } else {
          this.provider = this._primaryProvider;
        }
        debug("Attempting to reconnect... " + this.provider);
        const provider = new WebSocketProvider(this.provider);
        provider.on("connect", () => {
          this.connect();
        })
      }
    }, 5 * 1000);
  }

  issuer() {
    return new Promise(resolve => {
      this.contract.methods.issuer().call().then(result => {
        resolve(
          { issuer: result }
        );
      });
    });
  }

  getOwnedTokens(address) {
    return new Promise(resolve => {
      this.contract.methods.getOwnedTokens(address).call().then(result => {
        resolve(
          { ownedTokens: result }
        );
      });
    });
  }

  getContent(contentId) {
    return new Promise(resolve => {
      this.contract.methods.getContent(contentId).call().then(result => {
        resolve(
          { content: result }
        );
      });
    });
  }

  getToken(tokenId) {
    return new Promise(resolve => {
      this.contract.methods.getToken(tokenId).call().then(result => {
        resolve(
          { token: result }
        );
      });
    });
  }

  async sendSignedTransaction(serializedTx) {
    return new Promise((resolve, reject) => {
      this.web3.eth.sendSignedTransaction(serializedTx)
      .on("receipt", (receipt) => {
        resolve(receipt);
      })
      .on("error", (error) =>  {
        console.error;
        reject(error);
      })
    });
  }

  getPastEvents(eventName, fromBlock) {
    return new Promise(resolve => {
      this.contract.getPastEvents(eventName, {
        fromBlock,
        toBlock: 'latest',
      }, (error, events) => {
        if (!error) {
         resolve(events);
        } else {
          console.error(error);
          resolve();
        }
      })
      .then((events) => {
        resolve(events);
      });
    });
  }

  /**
   * Send transaction
   * @param {string} from
   * @param {string} privateKey
   * @param {object} txData
   * @returns
   */
  async _sendSignedTransaction(from, privateKey, txData) {
    const nonce = await this.web3.eth.getTransactionCount(from, "pending");
    const rawTx = {
      from,
      to: this.contract.options.address,
      gas: 29900000,
      gasLimit: 29900000,
      gasPrice: 0,
      data: txData,
      nonce: nonce,
    };
    const tx = LegacyTransaction.fromTxData(rawTx, { common });
    const signedTx = tx.sign(Buffer.from(privateKey.split('0x')[1], 'hex'));
    const serializedTx = signedTx.serialize();

    return new Promise((resolve, reject) => {
      this.web3.eth.sendSignedTransaction("0x" + Buffer.from(serializedTx).toString("hex"))
        .on("receipt", (receipt) => {
          resolve(receipt);
        })
        .on("error", (error) => {
          console.error;
          reject(error);
        })
    });
  }
}

module.exports = PluginContentNft;

const os = require('os');
const path = require('path');
const { promises: fs } = require('fs');
const startDapi = require('@dashevo/dp-services-ctl/lib/services/startDapi');
const wait = require('../../../../../lib/utils/wait');

describe('checkVersion', function main() {
  this.timeout(160000);

  let removeDapi;
  let dapiClient;
  let tmpPackageJson;

  beforeEach(async () => {
    const rawPackageJson = await fs.readFile(path.join(__dirname, '../../../../../package.json'), 'utf8');
    const packageJson = JSON.parse(rawPackageJson);
    packageJson.version = '666.666.666';
    tmpPackageJson = path.join(os.tmpdir(), 'dapiTmpPackage.json');

    await fs.writeFile(tmpPackageJson, JSON.stringify(packageJson), 'utf8');
    const rootPath = process.cwd();

    const dapiContainerOptions = {
      volumes: [
        `${rootPath}/lib:/usr/src/app/lib`,
        `${rootPath}/scripts:/usr/src/app/scripts`,
        `${tmpPackageJson}:/usr/src/app/package.json`,
      ],
    };

    const dapiOptions = {
      cacheNodeModules: false,
      container: dapiContainerOptions,
    };

    const {
      dapiTxFilterStream,
      remove,
    } = await startDapi({
      dapi: dapiOptions,
    });

    removeDapi = remove;

    dapiClient = dapiTxFilterStream.getApi();
  });

  afterEach(async () => {
    await fs.unlink(tmpPackageJson);
    await removeDapi();
  });

  it('should throw versions mismatch error', async () => {
    const stream = await dapiClient.subscribeToTransactionsWithProofs(
      {
        vData: new Uint8Array([157, 200]),
        nHashFuncs: 11,
        nTweak: 0,
        nFlags: 0,
      },
      {
        fromBlockHash: Buffer.from('69b9b6e1aaa0d5f364138106df68ec3bcfd132ebf1cfc6b94ee5dd2a15411bdc', 'hex'),
        count: 11,
      },
    );

    stream.on('data', () => {});

    let streamError;
    stream.on('error', (e) => {
      streamError = e;
    });

    while (!streamError) {
      await wait(1000);
    }

    expect(streamError.message).to.equal('9 FAILED_PRECONDITION: Failed precondition: client and server versions mismatch');
    expect(streamError.code).to.equal(9);
  });
});

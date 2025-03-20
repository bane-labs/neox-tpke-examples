import hash from 'hash.js';
import aes from 'aes-js';
import { Fp, Fp2 } from '@noble/curves/abstract/tower';
import { ProjPointType } from '@noble/curves/abstract/weierstrass';
import { bls12_381 as bls } from '@noble/curves/bls12-381';
import { abs, gcd, lcm, randBetween } from 'bigint-crypto-utils';
import { ByteArray, concat } from 'viem';

function laplace(matrix: bigint[][], r: bigint, c: bigint, order: bigint): bigint {
  let result = 0n;
  const cofactor = Array.from({ length: Number(order) }).map(() =>
    Array.from({ length: Number(order) }).map(() => 0n),
  );
  for (let i = 0n; i < order; i++) {
    for (let j = 0n; j < order; j++) {
      const tmpi = i;
      const tmpj = j;
      if (i !== r && j !== c) {
        if (i > r) {
          i--;
        }
        if (j > c) {
          j--;
        }
        cofactor[Number(i)][Number(j)] = matrix[Number(tmpi)][Number(tmpj)];
        i = tmpi;
        j = tmpj;
      }
    }
  }
  if (order >= 2n) {
    result = determinant(cofactor, order - 1n).d;
  }
  return result;
}

function determinant(matrix: bigint[][], order: bigint): { d: bigint; coeff: bigint[] } {
  let value = 0n;
  const coeff = Array.from({ length: Number(order) }).map(() => 0n);
  let sign = 1n;
  if (order === 1n) {
    value = matrix[0][0];
    coeff[0] = 1n;
  } else {
    for (let i = 0n; i < order; i++) {
      const cofactor = laplace(matrix, i, 0n, order);
      value += sign * matrix[Number(i)][0] * cofactor;
      coeff[Number(i)] = sign * cofactor;
      sign *= -1n;
    }
  }
  return { d: value, coeff };
}

function feldman(matrix: bigint[][]): { d: bigint; coeff: bigint[] } {
  const result = determinant(matrix, BigInt(matrix.length));
  let d = result.d;
  const coeff = result.coeff;
  let g = d;
  for (let i = 0n; i < coeff.length; i++) {
    g = gcd(g, coeff[Number(i)]);
  }
  d = d / g;
  for (let i = 0n; i < coeff.length; i++) {
    coeff[Number(i)] = coeff[Number(i)] / g;
  }
  if (d < 0n) {
    d = -d;
    for (let i = 0n; i < coeff.length; i++) {
      coeff[Number(i)] = -coeff[Number(i)];
    }
  }
  return { d, coeff };
}

function searchDlcm(
  matrix: bigint[][],
  l: bigint,
  pos: bigint,
  offset: bigint,
  size: bigint,
  threshold: bigint,
): bigint {
  if (pos === threshold) {
    const result = feldman(matrix);
    let d = result.d;
    const coeff = result.coeff;
    let g = d;
    for (let i = 0n; i < coeff.length; i++) {
      g = gcd(g, coeff[Number(i)]);
    }
    d = d / g;
    return BigInt(abs(d));
  }
  for (let i = pos + offset; i < size - threshold + pos + 1n; i++) {
    const row: bigint[] = Array.from({ length: Number(threshold) }).map(() => 0n);
    for (let j = 0n; j < threshold; j++) {
      row[Number(j)] = (i + 1n) ** j;
    }
    matrix[Number(pos)] = row;
    l = lcm(l, searchDlcm(matrix, l, pos + 1n, i - pos, size, threshold));
  }
  return l;
}

export function getConsensusThreshold(consensusSize: bigint): bigint {
  return consensusSize - (consensusSize - 1n) / 3n;
}

export function getScaler(size: bigint, threshold: bigint): bigint {
  const matrix: bigint[][] = Array.from({ length: Number(threshold) }).map(() => []);
  return searchDlcm(matrix, 1n, 0n, 0n, size, threshold);
}

function randScalar(): bigint {
  return randBetween(bls.G1.CURVE.n - 1n, 0n);
}

function randPg1(): ProjPointType<Fp> {
  const s = randScalar();
  // for test
  // const s = BigInt('13142576477868579383218672883803438445527974108075655005925877124647713243145');
  return bls.G1.ProjectivePoint.BASE.multiply(s);
}

class BlsCipherText {
  constructor(
    public cMsg: ProjPointType<Fp>,
    public bigR: ProjPointType<Fp>,
    public commitment: ProjPointType<Fp2>,
  ) {}

  verify(): boolean {
    throw new Error('Unimplemented');
  }

  toBytes(): ByteArray {
    return concat([this.cMsg.toRawBytes(), this.bigR.toRawBytes(), this.commitment.toRawBytes()]);
  }
}

function blsEncrypt(msg: ProjPointType<Fp>, pk: ProjPointType<Fp>): BlsCipherText {
  const r = randScalar();
  // for test
  // const r = BigInt('26241604929413036610059529953849322917897934190194857549647694249968225593684');

  // C=M+rpk, R1=rG1, R2=-rG2
  const rpk = pk.multiply(r);
  const cMsg = msg.add(rpk);

  const bigR1 = bls.G1.ProjectivePoint.BASE.multiply(r);
  const bigR2 = bls.G2.ProjectivePoint.BASE.multiply(r).negate();

  return new BlsCipherText(cMsg, bigR1, bigR2);
}

function aesEncrypt(msg: ByteArray, seed: ByteArray): ByteArray {
  if (msg.length < 1) {
    throw new Error('Empty aes message');
  }
  const seedHash = hash.sha256().update(seed).digest();
  const cipher = new aes.ModeOfOperation.cbc(seedHash, seedHash.slice(0, 16));
  const encrypted = cipher.encrypt(aes.padding.pkcs7.pad(msg));

  return encrypted;
}

export class PublicKey {
  constructor(public pg1: ProjPointType<Fp>) {}

  static fromAggregatedCommitment(aggregatedCommitment: ByteArray, scaler: bigint): PublicKey {
    if (aggregatedCommitment.length !== 128) {
      throw new Error('Invalid aggregated commitment');
    }

    let pg1 = bls.G1.ProjectivePoint.fromHex(
      concat([aggregatedCommitment.subarray(16, 64), aggregatedCommitment.subarray(80)]),
    );

    pg1 = pg1.multiply(scaler);

    return new PublicKey(pg1);
  }

  static fromBytes(bytes: ByteArray): PublicKey {
    const pg1 = bls.G1.ProjectivePoint.fromHex(bytes);
    return new PublicKey(pg1);
  }

  toBytes(): ByteArray {
    return this.pg1.toRawBytes();
  }

  encrypt(msg: ByteArray): { encryptedKey: ByteArray; encryptedMsg: ByteArray } {
    const aesKeyPg1 = randPg1();

    const encryptedKey = blsEncrypt(aesKeyPg1, this.pg1).toBytes();
    const encryptedMsg = aesEncrypt(msg, aesKeyPg1.toRawBytes(false));

    return { encryptedKey, encryptedMsg };
  }
}

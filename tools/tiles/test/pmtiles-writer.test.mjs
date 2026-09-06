/**
 * Saf JS PMTiles yazıcısının doğrulaması: ürettiğimiz arşivi, üretimde de kullanılan
 * `pmtiles` istemci kütüphanesi okuyabiliyor mu?
 *
 *   node --test tools/tiles/test/pmtiles-writer.test.mjs
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { PMTiles, zxyToTileId as refTileId } from 'pmtiles';
import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';

import { buildTiles, packPmtiles, serializeDirectory, writeVarint, zxyToTileId } from '../lib/pmtiles-writer.mjs';

const BBOX = [29.1, 40.09, 29.2, 40.15];

const LINE = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [29.11, 40.1],
          [29.15, 40.12],
          [29.18, 40.14],
        ],
      },
      properties: { highway: 'path', sac_scale: 'mountain_hiking', name: 'Test patikası' },
    },
  ],
};

/** Bellekteki arabelleği PMTiles istemcisine Range kaynağı gibi sunar. */
const sourceOf = (buffer) => ({
  getKey: () => 'test',
  getBytes: async (offset, length) => ({
    data: buffer.buffer.slice(buffer.byteOffset + offset, buffer.byteOffset + offset + length),
  }),
});

test('Hilbert karo kimliği referans uygulamayla birebir aynı', () => {
  for (let z = 0; z <= 14; z += 1) {
    for (let i = 0; i < 25; i += 1) {
      const x = Math.floor(Math.random() * 2 ** z);
      const y = Math.floor(Math.random() * 2 ** z);
      assert.equal(zxyToTileId(z, x, y), refTileId(z, x, y), `z${z}/${x}/${y}`);
    }
  }
});

test('varint LEB128 kodlaması', () => {
  assert.deepEqual(writeVarint([], 0), [0]);
  assert.deepEqual(writeVarint([], 127), [127]);
  assert.deepEqual(writeVarint([], 128), [0x80, 1]);
  assert.deepEqual(writeVarint([], 300), [0xac, 2]);
});

test('dizin serileştirmesi bitişik karoları 0 offset ile yazar', () => {
  const bytes = serializeDirectory([
    { tileId: 10, offset: 0, length: 5, runLength: 1 },
    { tileId: 12, offset: 5, length: 7, runLength: 1 },
  ]);
  // sayı(2) · delta(10,2) · runLength(1,1) · uzunluk(5,7) · offset(0+1, bitişik→0)
  assert.deepEqual([...bytes], [2, 10, 2, 1, 1, 5, 7, 1, 0]);
});

test('üretilen arşivi pmtiles istemcisi okuyabilir', async () => {
  const tiles = buildTiles({ trails: LINE }, { minzoom: 6, maxzoom: 14, bbox: BBOX });
  assert.ok(tiles.size > 0, 'karo üretilmedi');

  const { buffer, stats } = packPmtiles(tiles, {
    minzoom: 6,
    maxzoom: 14,
    bbox: BBOX,
    metadata: {
      name: 'test',
      vector_layers: [{ id: 'trails', fields: {}, minzoom: 6, maxzoom: 14 }],
    },
  });

  const archive = new PMTiles(sourceOf(buffer));
  const header = await archive.getHeader();
  assert.equal(header.specVersion, 3);
  assert.equal(header.tileType, 1, 'MVT olmalı');
  assert.equal(header.minZoom, 6);
  assert.equal(header.maxZoom, 14);
  assert.equal(header.clustered, true);
  assert.equal(header.numTileEntries, stats.tiles);
  assert.ok(Math.abs(header.minLon - BBOX[0]) < 1e-6);
  assert.ok(Math.abs(header.maxLat - BBOX[3]) < 1e-6);

  const metadata = await archive.getMetadata();
  assert.deepEqual(
    metadata.vector_layers.map((l) => l.id),
    ['trails'],
  );

  // Çizginin geçtiği karo gerçekten MVT içeriyor mu?
  const z = 12;
  const x = Math.floor(((29.15 + 180) / 360) * 2 ** z);
  const rad = (40.12 * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z);
  const tile = await archive.getZxy(z, x, y);
  assert.ok(tile, `z${z}/${x}/${y} karosu yok`);

  const decoded = new VectorTile(new PbfReader(new Uint8Array(tile.data)));
  assert.ok(decoded.layers.trails, 'trails katmanı yok');
  const feature = decoded.layers.trails.feature(0);
  assert.equal(feature.properties.highway, 'path');
  assert.equal(feature.properties.name, 'Test patikası');
});

test('bilinmeyen zum sınırı ve x/y taşması hata verir', () => {
  assert.throws(() => zxyToTileId(27, 0, 0));
  assert.throws(() => zxyToTileId(2, 4, 0));
});

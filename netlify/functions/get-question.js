const axios = require('axios');
const zlib = require('zlib');
const protobuf = require('protobufjs');

// Load Protobuf schema (gunakan path relatif ke file .proto)
const protoPath = '../question.proto'; // Sesuaikan dengan lokasi file .proto Anda

exports.handler = async (event, context) => {
  try {
    // URL file Protobuf terkompresi
    const url = 'https://pusat-api.netlify.app/question.bin.gz';

    // Unduh file Gzip
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const compressedData = response.data;

    // Dekompresi Gzip
    const decompressedData = zlib.gunzipSync(compressedData);

    // Load Protobuf schema
    const root = await protobuf.load(protoPath);
    const Question = root.lookupType('Question');

    // Deserialisasi Protobuf
    const question = Question.decode(decompressedData);

    // Konversi ke JSON
    const jsonData = Question.toObject(question, { enums: String, longs: String });

    // Kembalikan data sebagai respons JSON
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jsonData),
    };
  } catch (error) {
    console.error('Error:', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to process request' }),
    };
  }
};

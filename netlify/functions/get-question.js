const axios = require('axios');
const zlib = require('zlib'); // Gunakan zlib bawaan Node.js
const protobuf = require('protobufjs');

exports.handler = async (event, context) => {
  try {
    const url = 'https://pusat-api.netlify.app/question.bin.gz';
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const compressedData = response.data;

    // Dekompresi Gzip
    const decompressedData = zlib.gunzipSync(compressedData);

    // Load Protobuf schema
    const root = await protobuf.load('./question.proto');
    const Question = root.lookupType('Question');

    // Deserialisasi Protobuf
    const question = Question.decode(decompressedData);
    const jsonData = Question.toObject(question, { enums: String, longs: String });

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

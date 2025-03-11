const axios = require('axios');
const zlib = require('zlib'); // Gunakan zlib bawaan Node.js
const protobuf = require('protobufjs');

// Hardcode skema Protobuf
const root = new protobuf.Root();
root.addJSON({
  nested: {
    Question: {
      fields: {
        id: { type: "int32", id: 1 },
        author_nick: { type: "string", id: 2 },
        subject_name: { type: "string", id: 3 },
        typename: { type: "string", id: 4 },
        database_id: { type: "int32", id: 5 },
        content: { type: "string", id: 6 },
        created: { type: "string", id: 7 },
        thumbnail_url: { type: "string", id: 8 },
        answer_content: { type: "string", id: 9 },
        answer_nick: { type: "string", id: 10 },
        answer_ai: { type: "string", id: 11 }
      }
    }
  }
});

exports.handler = async (event, context) => {
  try {
    // URL file Protobuf terkompresi
    const url = 'https://pusat-api.netlify.app/question.bin.gz';

    // Unduh file Gzip
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const compressedData = response.data;

    // Dekompresi Gzip
    const decompressedData = zlib.gunzipSync(compressedData);

    // Deserialisasi Protobuf
    const Question = root.lookupType('Question');
    const question = Question.decode(decompressedData);
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

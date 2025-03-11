const axios = require('axios');
const zlib = require('zlib');
const protobuf = require('protobufjs');

// URL file Gzip
const gzipUrl = "https://pusat-api.netlify.app/question.bin.gz";

// Handler untuk serverless function
exports.handler = async (event, context) => {
  try {
    // Langkah 1: Unduh file Gzip
    const response = await axios({
      method: 'get',
      url: gzipUrl,
      responseType: 'arraybuffer'
    });

    // Langkah 2: Ekstrak file Gzip
    const buffer = await new Promise((resolve, reject) => {
      zlib.gunzip(response.data, (err, buffer) => {
        if (err) reject(err);
        else resolve(buffer);
      });
    });

    // Langkah 3: Definisikan skema Protobuf secara langsung
    const root = protobuf.Root.fromJSON({
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

    // Langkah 4: Decode data Protobuf
    const Question = root.lookupType("Question");
    const message = Question.decode(buffer);
    const json_data = Question.toObject(message, { longs: String, enums: String, bytes: String });

    // Langkah 5: Kirim respons JSON
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(json_data)
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" })
    };
  }
};

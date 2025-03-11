const axios = require('axios');
const zlib = require('zlib');
const protobuf = require('protobufjs');

// Daftar file .bin.gz yang tersedia di pusat-api.netlify.app
const availableFiles = [
  "question.bin.gz",
  "question.bin.gz",
  "question.bin.gz",
  "question.bin.gz",
  "question.bin.gz",
];

// URL dasar untuk file .bin.gz
const baseUrl = "https://pusat-api.netlify.app/";

// Handler untuk serverless function
exports.handler = async (event, context) => {
  try {
    // Parse payload dari request body
    const payload = JSON.parse(event.body);

    // Validasi payload
    if (!payload.max || !payload.target) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Payload harus berisi 'max' dan 'target'" })
      };
    }

    const { max, target } = payload;

    // Skema Protobuf (embed dalam kode)
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

    const Question = root.lookupType("Question");

    // Fungsi untuk mengunduh dan memproses satu file .bin.gz
    const fetchData = async (file) => {
      const gzipUrl = `${baseUrl}${file}`;
      const response = await axios({
        method: 'get',
        url: gzipUrl,
        responseType: 'arraybuffer'
      });

      const buffer = await new Promise((resolve, reject) => {
        zlib.gunzip(response.data, (err, buffer) => {
          if (err) reject(err);
          else resolve(buffer);
        });
      });

      const message = Question.decode(buffer);
      return Question.toObject(message, { longs: String, enums: String, bytes: String });
    };

    // Handle permintaan berdasarkan target
    if (target === "random") {
      // Pilih file secara acak sebanyak max
      const randomFiles = [];
      for (let i = 0; i < max && i < availableFiles.length; i++) {
        const randomIndex = Math.floor(Math.random() * availableFiles.length);
        randomFiles.push(availableFiles[randomIndex]);
      }

      // Unduh dan proses data dari file-file yang dipilih
      const results = await Promise.all(randomFiles.map(fetchData));
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(results)
      };
    } else {
      // Cek apakah target ada di daftar file yang tersedia
      if (!availableFiles.includes(target)) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: `File '${target}' tidak ditemukan` })
        };
      }

      // Unduh dan proses data dari file target
      const result = await fetchData(target);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result)
      };
    }
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" })
    };
  }
};

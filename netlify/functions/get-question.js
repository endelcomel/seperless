const axios = require('axios');
const zlib = require('zlib');
const protobuf = require('protobufjs');
const { fileRanges } = require('./config'); // Impor fileRanges

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
    const fetchData = async (baseUrl, file) => {
      const gzipUrl = `${baseUrl}/${file}`;
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
      // Pilih rentang secara random
      const randomRange = fileRanges[Math.floor(Math.random() * fileRanges.length)];
      const { baseUrl, start, end } = randomRange;

      // Pilih nomor file secara random dalam rentang
      const randomFileNumber = Math.floor(Math.random() * (end - start + 1)) + start;
      const randomFile = `${randomFileNumber}.bin.gz`;

      // Unduh dan proses data dari file yang dipilih
      const result = await fetchData(baseUrl, randomFile);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result)
      };
    } else {
      // Ekstrak nomor file dari target
      const fileNumber = parseInt(target.split('.')[0], 10);
      if (isNaN(fileNumber)) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "Format target tidak valid" })
        };
      }

      // Cari baseUrl yang sesuai dengan rentang
      const selectedRange = fileRanges.find(range => fileNumber >= range.start && fileNumber <= range.end);
      if (!selectedRange) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: `File '${target}' tidak ditemukan dalam rentang yang tersedia` })
        };
      }

      const baseUrl = selectedRange.baseUrl;

      // Unduh dan proses data dari file target
      const result = await fetchData(baseUrl, target);
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

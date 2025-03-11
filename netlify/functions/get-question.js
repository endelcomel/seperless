const axios = require('axios');
const zlib = require('zlib');
const protobuf = require('protobufjs');

// URL file Gzip
const url = "https://pusat-api.netlify.app/question.bin.gz";

// Langkah 1: Unduh file Gzip
axios({
  method: 'get',
  url: url,
  responseType: 'arraybuffer' // Penting untuk menerima data biner
})
  .then(response => {
    // Langkah 2: Ekstrak file Gzip
    zlib.gunzip(response.data, (err, buffer) => {
      if (err) {
        console.error("Gagal mengekstrak file Gzip:", err);
        return;
      }

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

      // Langkah 5: Tampilkan data dalam format JSON
      console.log("Data dalam format JSON:");
      console.log(JSON.stringify(json_data, null, 2));
    });
  })
  .catch(err => {
    console.error("Gagal mengunduh file:", err);
  });

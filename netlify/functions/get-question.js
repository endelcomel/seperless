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

    // Fungsi untuk memvalidasi keberadaan file
    const validateFileExists = async (baseUrl, file) => {
      try {
        const response = await axios.head(`${baseUrl}/${file}`);
        return response.status === 200; // File ditemukan jika status 200
      } catch (error) {
        return false; // File tidak ditemukan
      }
    };

    // Handle permintaan berdasarkan target
    if (target === "random") {
      const results = [];
      const selectedFiles = new Set(); // Untuk menghindari duplikasi file

      for (let i = 0; i < max; i++) {
        let randomFile, baseUrl;

        // Loop untuk memastikan file yang dipilih benar-benar ada dan tidak duplikat
        while (true) {
          // Pilih rentang secara random
          const randomRange = fileRanges[Math.floor(Math.random() * fileRanges.length)];
          baseUrl = randomRange.baseUrl;
          const { start, end } = randomRange;

          // Hasilkan nomor file acak dalam rentang
          const randomFileNumber = Math.floor(Math.random() * (end - start + 1)) + start;
          randomFile = `${randomFileNumber}.bin.gz`;

          // Cek apakah file sudah dipilih atau tidak
          if (selectedFiles.has(randomFile)) continue;

          // Validasi keberadaan file
          const fileExists = await validateFileExists(baseUrl, randomFile);
          if (fileExists) {
            selectedFiles.add(randomFile); // Tandai file sebagai telah dipilih
            break; // Keluar dari loop jika file valid
          }
        }

        // Unduh dan proses data dari file yang dipilih
        const result = await fetchData(baseUrl, randomFile);
        results.push(result);
      }

      // Kembalikan hasil sebagai array
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(results)
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

      // Validasi keberadaan file
      const fileExists = await validateFileExists(baseUrl, target);
      if (!fileExists) {
        // Jika file tidak ditemukan, cari file random dari rentang yang sesuai
        let randomFile;
        do {
          const { start, end } = selectedRange;
          const randomFileNumber = Math.floor(Math.random() * (end - start + 1)) + start;
          randomFile = `${randomFileNumber}.bin.gz`;
        } while (!(await validateFileExists(baseUrl, randomFile)));

        // Unduh dan proses file random
        const result = await fetchData(baseUrl, randomFile);
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(result)
        };
      }

      // Jika file ditemukan, unduh dan proses file tersebut
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

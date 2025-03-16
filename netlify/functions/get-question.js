const axios = require('axios');
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

    // Fungsi untuk mengambil data dari API
    const fetchDataFromAPI = async (baseUrl, file) => {
      const apiUrl = `${baseUrl}/${file}`;
      try {
        const response = await axios.get(apiUrl);
        return response.data; // Asumsikan API mengembalikan data JSON
      } catch (error) {
        if (error.response && error.response.status === 404) {
          throw new Error(`Data '${file}' tidak ditemukan`);
        }
        throw error;
      }
    };

    // Fungsi untuk mendapatkan data random dari rentang yang sesuai
    const getRandomDataFromRange = async (fileNumber) => {
      // Cari rentang yang sesuai dengan nomor file
      const selectedRange = fileRanges.find(range => fileNumber >= range.start && fileNumber <= range.end);
      if (!selectedRange) {
        throw new Error(`Nomor '${fileNumber}' tidak ditemukan dalam rentang yang tersedia`);
      }

      const { baseUrl, start, end } = selectedRange;

      // Loop untuk memastikan data yang dipilih benar-benar ada
      while (true) {
        const randomFileNumber = Math.floor(Math.random() * (end - start + 1)) + start;
        const randomFile = `${randomFileNumber}.bin.gz`;

        try {
          const data = await fetchDataFromAPI(baseUrl, randomFile);
          return data;
        } catch (error) {
          continue; // Coba lagi jika data tidak ditemukan
        }
      }
    };

    // Handle permintaan berdasarkan target
    if (target === "random") {
      // Mode random tetap sama seperti sebelumnya
      const results = [];
      for (let i = 0; i < max; i++) {
        const randomFileNumber = Math.floor(Math.random() * (fileRanges[0].end - fileRanges[0].start + 1)) + fileRanges[0].start;
        const randomFile = `${randomFileNumber}.bin.gz`;
        const baseUrl = fileRanges[0].baseUrl;

        try {
          const data = await fetchDataFromAPI(baseUrl, randomFile);
          results.push(data);
        } catch (error) {
          console.error(`Error fetching random file: ${randomFile}`, error.message);
        }
      }
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

      try {
        // Coba ambil data dari API menggunakan target
        const selectedRange = fileRanges.find(range => fileNumber >= range.start && fileNumber <= range.end);
        if (!selectedRange) {
          throw new Error(`Nomor '${fileNumber}' tidak ditemukan dalam rentang yang tersedia`);
        }

        const baseUrl = selectedRange.baseUrl;
        const data = await fetchDataFromAPI(baseUrl, target);
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        };
      } catch (error) {
        console.error(`Error fetching target data: ${target}`, error.message);

        // Jika gagal, ambil data random dari rentang yang sesuai
        try {
          const randomData = await getRandomDataFromRange(fileNumber);
          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(randomData)
          };
        } catch (fallbackError) {
          console.error(`Error fetching random data as fallback:`, fallbackError.message);
          return {
            statusCode: 500,
            body: JSON.stringify({ error: "Gagal mengambil data target dan fallback" })
          };
        }
      }
    }
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" })
    };
  }
};

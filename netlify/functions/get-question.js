const axios = require('axios');
const zlib = require('zlib');
const protobuf = require('protobufjs');

// Daftar rentang file dengan URL
const fileRanges = [
  { baseUrl: "https://67d4d639423cb651d341c988--pusat-api.netlify.app/", start: "45358102.bin.gz", end: "56237543.bin.gz" },
  { baseUrl: "https://67d4d63dcf00c45c95782a6a--pusat-api.netlify.app/", start: "45359902.bin.gz", end: "56241290.bin.gz" },
  { baseUrl: "https://67d4d64b653aef522502b7ef--pusat-api.netlify.app/", start: "45359865.bin.gz", end: "56241514.bin.gz" }
];

exports.handler = async (event, context) => {
  try {
    const payload = JSON.parse(event.body);
    if (!payload.max || !payload.target) {
      return { statusCode: 400, body: JSON.stringify({ error: "Payload harus berisi 'max' dan 'target'" }) };
    }
    
    const { max, target } = payload;
    
    // Cari rentang yang sesuai dengan target
    let selectedRange = fileRanges.find(range => target >= range.start && target <= range.end);
    if (!selectedRange) {
      return { statusCode: 404, body: JSON.stringify({ error: `File '${target}' tidak termasuk dalam rentang yang tersedia` }) };
    }

    const fetchFile = async (file) => {
      try {
        const response = await axios.get(`${selectedRange.baseUrl}${file}`, { responseType: 'arraybuffer' });
        return response.data;
      } catch (error) {
        if (error.response && error.response.status === 404) {
          return null;
        }
        throw error;
      }
    };
    
    let fileData = await fetchFile(target);
    if (!fileData) {
      // Jika file tidak ditemukan, pilih file acak dari rentang
      const randomFileNumber = Math.floor(Math.random() * (parseInt(selectedRange.end) - parseInt(selectedRange.start))) + parseInt(selectedRange.start);
      const randomFile = `${randomFileNumber}.bin.gz`;
      fileData = await fetchFile(randomFile);
      if (!fileData) {
        return { statusCode: 404, body: JSON.stringify({ error: `Tidak ada file yang dapat diambil dalam rentang ${selectedRange.start} - ${selectedRange.end}` }) };
      }
    }
    
    // Dekompresi dan decode data Protobuf
    const buffer = await new Promise((resolve, reject) => {
      zlib.gunzip(fileData, (err, buffer) => {
        if (err) reject(err);
        else resolve(buffer);
      });
    });

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
    const message = Question.decode(buffer);
    const result = Question.toObject(message, { longs: String, enums: String, bytes: String });
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error("Error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Internal Server Error" }) };
  }
};

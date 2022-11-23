const axios = require('axios');
const Web3 = require('web3');
const abi = require('./token.abi.json');
const address = '0xbd3547dd04a84995cdbc2a45c9e67ae9c64b4c4c';
const fs = require('fs')

const { stringify } = require("csv-stringify");
const filename = "token_tracker.csv";
const writableStream = fs.createWriteStream(filename);

const columns = [
  "date",
  "date_time",
  "unix_timestamp",
  "usd",
];

const stringifier = stringify({ header: true, columns: columns });


const trackToken = async () => {
  const res = await axios.get('https://api.coingecko.com/api/v3/coins/matic-network/market_chart?vs_currency=usd&days=274&interval=daily', {
    headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Accept-Encoding': 'Origin'
    },
  });
  const historicalMaticPrice = res.data.prices.reverse();

  const web3 = await new Web3('');
  const contract = await new web3.eth.Contract(abi, address);
  const firstBlock = 26391957;
  const lastBlock =  35969506;
  let allSyncedData = [];
  for(let i = firstBlock; i <= lastBlock; i += 3500) {
    await contract.getPastEvents('Sync', {
      fromBlock: i,
      toBlock: i+3499,
    })
      .then(function(events){
        allSyncedData = allSyncedData.concat(events);
      });

  }
  allSyncedData = await Promise.all(await allSyncedData.map(async (event) => {
    const block = await web3.eth.getBlock(event.blockNumber);
    const timestamp = block.timestamp;
    const date_time = new Date(timestamp * 1000);
    const date = date_time.toLocaleDateString('en-GB');
    const newEvent = event;
    newEvent.date = date;
    newEvent.date_time = date_time.toTimeString();

    // const date1 = new Date(start);
    //  const date2 = new Date(end);
    const todaysDate = new Date();
    // One day in milliseconds
    const oneDay = 1000 * 60 * 60 * 24;
    // Calculating the time difference between two dates
    const diffInTime = todaysDate.getTime() - date_time.getTime();

    // Calculating the no. of days between two dates
    const diffInDays = Math.round(diffInTime / oneDay);
    newEvent.daysAgo = diffInDays;
    newEvent.unix_timestamp = timestamp;
    return newEvent;
  }));
  const orderedSyncData = allSyncedData.sort((a,b) => {
    return a.blockNumber - b.blockNumber;
  });
  const stringifier = stringify({ header: true, columns: columns });
  orderedSyncData.forEach((row) => {
    const newRow = row;
    console.log(row.daysAgo)
    const maticDailyPrice = historicalMaticPrice[row.daysAgo][1];
    console.log(maticDailyPrice)
    console.log(web3.utils.fromWei(row.returnValues.reserve0),  web3.utils.fromWei(row.returnValues.reserve1))
    const maticValue = maticDailyPrice * web3.utils.fromWei(row.returnValues.reserve0);
    console.log(maticValue)
    const iceValue =  maticValue /web3.utils.fromWei(row.returnValues.reserve1);
    console.log(iceValue);
    newRow.usd = iceValue;
    stringifier.write(newRow);
  });
  stringifier.pipe(writableStream);
};

trackToken();
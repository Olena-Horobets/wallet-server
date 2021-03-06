const { BadRequest } = require('http-errors');
const { Transaction, User } = require('../../models');

const addTransaction = async (req, res) => {
  const { _id, balance } = req.user;
  const { date, type, amount } = req.body;
  const limit = 12;

  let newBalance = Number((type ? balance + Number(amount) : balance - Number(amount)).toFixed(2));

  const checkingNextTransactions = await Transaction.find({
    owner: _id,
    date: { $gte: date },
  }).sort({
    date: -1,
    createdAt: -1,
  });

  const checkingTransactions = [...checkingNextTransactions, { ...req.body }];

  checkingTransactions.reduce((balance, tr) => {
    if (balance < 0) throw new BadRequest('Balance cannot be negative');

    return tr.type ? balance - Number(tr.amount) : balance + Number(tr.amount);
  }, newBalance);

  const user = await User.findById(_id);

  user.setBalance(newBalance).incrementTotalTransactions().save();

  await Transaction.create({ ...req.body, owner: _id });

  const nextTransactions = await Transaction.find({
    owner: _id,
    date: { $gte: date },
  }).sort({
    date: -1,
    createdAt: -1,
  });

  for (let i = 0; i < nextTransactions.length; i += 1) {
    await Transaction.findByIdAndUpdate(nextTransactions[i]._id, {
      balance: Number(newBalance.toFixed(2)),
    });

    nextTransactions[i].type
      ? (newBalance -= nextTransactions[i].amount)
      : (newBalance += nextTransactions[i].amount);
  }

  const transactions = await Transaction.find({ owner: _id }, { owner: 0 }, { limit }).sort({
    date: -1,
    createdAt: -1,
  });

  const totalPages = Math.ceil(user.totalTransactions / limit);

  res.status(201).json({
    transactions,
    balance: user.balance,
    page: 1,
    totalPages,
  });
};

module.exports = addTransaction;

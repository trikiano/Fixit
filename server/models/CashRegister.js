import { DataTypes } from 'sequelize';

export const defineCashRegister = (sequelize) => {
  return sequelize.define('CashRegister', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    date: { type: DataTypes.STRING(20), allowNull: false }, // Store as YYYY-MM-DD
    opening_balance: { type: DataTypes.FLOAT, defaultValue: 0 },
    closing_balance: { type: DataTypes.FLOAT, allowNull: true },
    expected_balance: { type: DataTypes.FLOAT, allowNull: true },
    total_cash_sales: { type: DataTypes.FLOAT, defaultValue: 0 },
    total_card_sales: { type: DataTypes.FLOAT, defaultValue: 0 },
    total_expenses: { type: DataTypes.FLOAT, defaultValue: 0 },
    difference: { type: DataTypes.FLOAT, allowNull: true },
    difference_reason: { type: DataTypes.TEXT, allowNull: true },
    status: { type: DataTypes.STRING(20), defaultValue: 'ouverte' }, // 'ouverte', 'fermee'
    opened_by: { type: DataTypes.STRING(100), allowNull: true },
    closed_by: { type: DataTypes.STRING(100), allowNull: true },
    closing_date: { type: DataTypes.STRING(30), allowNull: true }, // ISO string when closed
    user_id:   { type: DataTypes.UUID, allowNull: true },
    shop_id:   { type: DataTypes.UUID, allowNull: true },
  });
};


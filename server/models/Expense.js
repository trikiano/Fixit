import { DataTypes } from 'sequelize';

export function defineExpense(sequelize) {
  return sequelize.define('Expense', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    description: { type: DataTypes.STRING, allowNull: false },
    amount: { type: DataTypes.FLOAT, defaultValue: 0 },
    category: { type: DataTypes.STRING },
    payment_method: { type: DataTypes.STRING },
    date: { type: DataTypes.DATEONLY },
    supplier_id: { type: DataTypes.UUID },
    supplier_name: { type: DataTypes.STRING },
    reference: { type: DataTypes.STRING },
    notes: { type: DataTypes.TEXT },
    is_recurring: { type: DataTypes.BOOLEAN, defaultValue: false },
    shop_id: { type: DataTypes.UUID, allowNull: true },
  }, { tableName: 'expenses' });
}

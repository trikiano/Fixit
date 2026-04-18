import { DataTypes } from 'sequelize';

export function defineClient(sequelize) {
  return sequelize.define('Client', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    full_name: { type: DataTypes.STRING, allowNull: false },
    phone: { type: DataTypes.STRING },
    email: { type: DataTypes.STRING },
    address: { type: DataTypes.TEXT },
    notes: { type: DataTypes.TEXT },
    loyalty_points: { type: DataTypes.INTEGER, defaultValue: 0 },
    total_spent: { type: DataTypes.FLOAT, defaultValue: 0 },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  }, { tableName: 'clients' });
}

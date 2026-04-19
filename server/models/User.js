import { DataTypes } from 'sequelize';

export function defineUser(sequelize) {
  const User = sequelize.define('User', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    password_hash: { type: DataTypes.STRING, allowNull: false },
    full_name: { type: DataTypes.STRING },
    role: { type: DataTypes.ENUM('super_admin', 'admin', 'manager', 'employee'), defaultValue: 'employee' },
    shop_id: { type: DataTypes.UUID, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    avatar_url: { type: DataTypes.STRING },
    permissions: { type: DataTypes.TEXT, defaultValue: '[]' },
  }, {
    tableName: 'users',
  });

  return User;
}


import { DataTypes } from 'sequelize';
import bcrypt from 'bcryptjs';

export function defineUser(sequelize) {
  const User = sequelize.define('User', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    password_hash: { type: DataTypes.STRING, allowNull: false },
    full_name: { type: DataTypes.STRING },
    role: { type: DataTypes.ENUM('admin', 'manager', 'employee'), defaultValue: 'employee' },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    avatar_url: { type: DataTypes.STRING },
    permissions: { type: DataTypes.TEXT, defaultValue: '[]' }, // JSON array of allowed module names
  }, { 
    tableName: 'users',
    hooks: {
      beforeSave: async (user) => {
        if (user.changed('password_hash')) {
          const salt = await bcrypt.genSalt(10);
          user.password_hash = await bcrypt.hash(user.password_hash, salt);
        }
      }
    }
  });

  return User;
}


import { DataTypes } from 'sequelize';

export const defineBrand = (sequelize) => {
  return sequelize.define('Brand', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    // Optional: category hints or simple metadata
    category: {
      type: DataTypes.STRING,
      allowNull: true,
    }
  });
};

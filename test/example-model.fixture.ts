export function createModelDouble() {
  const save = jest.fn();
  const exec = jest.fn();
  const model = jest.fn().mockImplementation(() => ({ save }));
  return Object.assign(model, {
    save,
    exec,
    find: jest.fn(() => ({ exec })),
    findById: jest.fn(() => ({ exec })),
    findOne: jest.fn(() => ({ exec })),
    findByIdAndUpdate: jest.fn(() => ({ exec })),
    findByIdAndDelete: jest.fn(() => ({ exec })),
  });
}

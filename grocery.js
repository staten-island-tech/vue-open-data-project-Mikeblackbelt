total = () => {return (1 - 0.1 * ((cart.reduce((sum, item) =>sum + item.price * item.quantity * (1 - 0.05 * (item.price < 5)), 0)) > 100)) * cart.reduce((sum, item) => sum + item.price * item.quantity * (1 - 0.05 * (item.price < 5)), 0);}
const cart = [
  { name: "Apples", price: 3.5, quantity: 4 },
  { name: "Milk", price: 4.75, quantity: 2 },
  { name: "Steak", price: 15.99, quantity: 3 },
  { name: "Cereal", price: 5.25, quantity: 1 },
  { name: "Bananas", price: 1.25, quantity: 6 }
];

console.log(total(cart))
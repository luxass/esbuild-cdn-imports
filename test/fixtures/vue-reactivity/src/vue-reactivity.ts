import { ref } from "@vue/reactivity";

const a = ref(1);

console.log(a);

a.value += 1;

console.log(a);

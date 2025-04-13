import { ref, computed } from "vue";

const count = ref(0);
const doubleCount = computed(() => count.value * 2);

export const increment = () => {
  count.value++;
  return doubleCount.value;
};

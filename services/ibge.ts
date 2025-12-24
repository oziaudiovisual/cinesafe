
interface UF {
  id: number;
  sigla: string;
  nome: string;
}

interface City {
  id: number;
  nome: string;
}

export const IBGEService = {
  getUFs: async (): Promise<UF[]> => {
    try {
      const response = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome');
      if (!response.ok) throw new Error('Erro ao buscar estados');
      return await response.json();
    } catch (error) {
      console.error(error);
      return [];
    }
  },

  getCitiesByUF: async (ufSigla: string): Promise<City[]> => {
    try {
      if (!ufSigla) return [];
      const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${ufSigla}/municipios`);
      if (!response.ok) throw new Error('Erro ao buscar cidades');
      return await response.json();
    } catch (error) {
      console.error(error);
      return [];
    }
  }
};

import random
from dataclasses import dataclass
from typing import List, Dict, Optional

@dataclass
class Card:
    value: int
    color: str
    is_tactic: bool = False
    name: str = ""

class Tile:
    def __init__(self, name: str, req_whole: int, req_damaged: int, rule_type: str):
        self.name = name
        self.state = "cala" 
        self.req_whole = req_whole
        self.req_damaged = req_damaged
        self.rule_type = rule_type 
        self.cards_attacker: List[Card] = []
        self.cards_defender: List[Card] = []

    def get_capacity(self) -> int:
        return self.req_damaged if self.state == "uszkodzona" else self.req_whole

class Player:
    def __init__(self, role: str):
        self.role = role 
        self.hand: List[Card] = []
        self.tar_cauldrons = 3 if role == "Obronca" else 0

class GameEngine:
    def __init__(self):
        self.deck: List[Card] = self._generate_deck()
        self.tiles: List[Tile] = self._generate_tiles()
        self.players: Dict[str, Player] = {
            "p1": Player("Atakujacy"),
            "p2": Player("Obronca")
        }
        self.current_turn = "p1" 
        self.phase = "attack_resolution" 
        self.winner: Optional[str] = None
        self._deal_initial_cards()

    def _generate_deck(self) -> List[Card]:
        colors = ['czerwony', 'niebieski', 'zielony', 'zolty', 'fioletowy']
        deck = [Card(v, c) for c in colors for v in range(12)]
        random.shuffle(deck)
        return deck

    def _generate_tiles(self) -> List[Tile]:
        tiles = [
            Tile("Standardowy 1", 3, 4, "standard"),
            Tile("Standardowy 2", 3, 4, "standard"),
            Tile("Szybkie zwarcie", 2, 3, "standard"),
            Tile("Dlugie oblezenie", 4, 5, "standard"),
            Tile("Czysta Sila", 3, 4, "zgraja"),
            Tile("Taktyczny odwrot", 3, 4, "slabosc"),
            Tile("Waskie gardlo", 3, 4, "jeden_kolor")
        ]
        random.shuffle(tiles)
        return tiles

    def _deal_initial_cards(self):
        for _ in range(6):
            self.players["p1"].hand.append(self.deck.pop())
            self.players["p2"].hand.append(self.deck.pop())

    def play_card(self, player_id: str, card_index: int, tile_index: int) -> bool:
        if self.current_turn != player_id or self.phase != "play_card":
            raise ValueError("To nie jest twoja tura na zagranie karty!")
        
        tile = self.tiles[tile_index]
        if tile.state == "zniszczona":
            raise ValueError("Ten kafelek jest już całkowicie zniszczony.")

        player_cards = tile.cards_attacker if self.players[player_id].role == "Atakujacy" else tile.cards_defender
        
        if len(player_cards) >= tile.get_capacity():
            raise ValueError("Brak miejsca na tym kafelku!")

        card = self.players[player_id].hand.pop(card_index)
        player_cards.append(card)
        self.phase = "draw_card"
        return True

    def use_tar_cauldron(self, player_id: str, tile_index: int) -> bool:
        player = self.players[player_id]
        if player.role != "Obronca" or self.current_turn != player_id or self.phase != "play_card":
            raise ValueError("Nie możesz teraz użyć kotła ze smołą.")
        if player.tar_cauldrons <= 0:
            raise ValueError("Brak kotłów ze smołą!")
        
        tile = self.tiles[tile_index]
        if not tile.cards_attacker:
            raise ValueError("Brak kart Atakującego przy tym kafelku.")

        tile.cards_attacker.pop()
        player.tar_cauldrons -= 1
        self._end_turn()
        return True

    def draw_card(self, player_id: str) -> bool:
        if self.current_turn != player_id or self.phase != "draw_card":
            raise ValueError("To nie jest twoja tura na dobieranie!")
        
        if self.deck:
            self.players[player_id].hand.append(self.deck.pop())
        
        self._end_turn()
        self._check_end_game_condition()
        return True

    def _end_turn(self):
        self.current_turn = "p2" if self.current_turn == "p1" else "p1"
        self.phase = "attack_resolution" if self.current_turn == "p1" else "play_card"

    def attempt_attack(self, tile_index: int):
        if self.players[self.current_turn].role != "Atakujacy" or self.phase != "attack_resolution":
            raise ValueError("Tylko Atakujący może inicjować atak na początku tury.")
        
        tile = self.tiles[tile_index]
        capacity = tile.get_capacity()
        
        if len(tile.cards_attacker) != capacity:
            raise ValueError("Nie masz wystarczającej liczby kart, aby zaatakować ten kafelek.")
        
        score_attacker = self._evaluate_formation(tile.cards_attacker, tile.rule_type)
        score_defender = self._evaluate_formation(tile.cards_defender, tile.rule_type)

        if len(tile.cards_defender) == capacity:
            if score_attacker > score_defender:
                self._damage_tile(tile)
            else:
                raise ValueError("Atak odparty! Twoja formacja jest słabsza lub równa.")
        else:
            if score_attacker > 5000: 
                self._damage_tile(tile)
            else:
                raise ValueError("Nie możesz udowodnić wygranej. Obrońca wciąż ma szansę.")

        self.phase = "play_card"

    def _damage_tile(self, tile: Tile):
        if tile.state == "cala":
            tile.state = "uszkodzona"
            tile.cards_attacker.clear()
            tile.cards_defender.clear()
        elif tile.state == "uszkodzona":
            tile.state = "zniszczona"
            self.winner = "Atakujacy"

    def _evaluate_formation(self, cards: List[Card], rule_type: str) -> int:
        if not cards:
            return 0
            
        values = sorted([c.value for c in cards])
        colors = [c.color for c in cards]
        suma = sum(values)

        if rule_type == "zgraja":
            return suma
        elif rule_type == "slabosc":
            return 1000 - suma 

        is_flush = len(set(colors)) == 1
        is_straight = all(values[i] + 1 == values[i+1] for i in range(len(values) - 1))
        is_three_of_kind = len(set(values)) == 1

        base_score = 1000
        if is_flush and is_straight:
            base_score = 5000
        elif is_three_of_kind:
            base_score = 4000
        elif is_flush:
            base_score = 3000
        elif is_straight:
            base_score = 2000

        return base_score + suma

    def _check_end_game_condition(self):
        damaged_count = sum(1 for t in self.tiles if t.state in ["uszkodzona", "zniszczona"])
        if damaged_count >= 4:
            self.winner = "Atakujacy"
            
        if not self.deck:
            self.winner = "Obronca"

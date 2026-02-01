from kivymd.app import MDApp
from kivymd.uix.label import MDLabel
from kivymd.uix.screen import Screen
from kivymd.uix.textfield import MDTextField
from kivymd.uix.button import MDRectangleFlatButton
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.gridlayout import GridLayout
from kivymd.uix.anchorlayout import AnchorLayout
from kivymd.uix.tab import MDTabsBase, MDTabs
from kivymd.uix.scrollview import MDScrollView
from kivymd.uix.expansionpanel import MDExpansionPanel, MDExpansionPanelOneLine
import random
import math
import os
from kivy.utils import platform


class Tab(MDBoxLayout, MDTabsBase):
    """Class implementing content for a tab."""
    pass


def is_android():
    """Detect if the app is running on Android."""
    return platform == 'android'


def is_windows():
    """Detect if the app is running on Windows."""
    return platform == 'win'


class CaromModel:
    """Model class that holds all application state."""
    
    START_ENTERING_SCORE = 0
    UPDATE_ENTERING_SCORE = 1
    DEFAULT_TARGET = 0.90
    DEFAULT_TARGET_STEP = 0.10
    
    def __init__(self):
        # Game state
        self.current_score = 0
        self.played_turns = 0
        self.target = self.DEFAULT_TARGET
        self.target_step = self.DEFAULT_TARGET_STEP
        self.num_zero_scores = 0
        self.input_state = self.START_ENTERING_SCORE
        self.add_score_value = 0
        
        # Moyennes list
        self.moyennes_list = self._load_moyennes()
    
    def _load_moyennes(self):
        """Load moyennes from file on Android or generate random values."""
        if is_android():
            file_path = '/storage/emulated/0/Pydroid 3/carom_scores.txt'
            if os.path.exists(file_path):
                try:
                    with open(file_path, 'r') as f:
                        moyennes = [float(line.strip()) for line in f.readlines()[:20]]
                        while len(moyennes) < 20:
                            moyennes.append(1.00)
                        return moyennes
                except (IOError, ValueError):
                    pass
        
        # Default: random values
        return [round(random.uniform(0.5, 2.0), 2) for _ in range(20)]
    
    def get_current_moyenne(self):
        """Calculate current game moyenne."""
        if self.played_turns > 0:
            return self.current_score / self.played_turns
        return 0.0
    
    def get_avg_moyenne(self):
        """Calculate average of moyennes list."""
        if not self.moyennes_list:
            return 0.0
        return sum(self.moyennes_list) / len(self.moyennes_list)
    
    def get_score_target(self):
        """Calculate score target based on average moyenne."""
        return math.floor(25.0 * self.get_avg_moyenne())
    
    def add_to_score(self, points):
        """Add points to current score and increment turns."""
        if points == 0:
            self.num_zero_scores += 1
        self.current_score += points
        self.played_turns += 1
    
    def reset_game(self):
        """Reset current game state."""
        self.current_score = 0
        self.played_turns = 0
        self.num_zero_scores = 0
        self.input_state = self.START_ENTERING_SCORE
        self.add_score_value = 0
    
    def end_game(self):
        """End game and add moyenne to list."""
        if self.played_turns > 0:
            game_moyenne = self.get_current_moyenne()
            self.moyennes_list.pop(0)
            self.moyennes_list.append(round(game_moyenne, 2))
        self.reset_game()
    
    def add_moyenne_to_list(self, moyenne):
        """Add a moyenne to the FIFO list."""
        self.moyennes_list.pop(0)
        self.moyennes_list.append(moyenne)
    
    def update_input_digit(self, digit):
        """Update the add score input with a digit."""
        if self.input_state == self.START_ENTERING_SCORE:
            self.add_score_value = 0
        self.add_score_value = self.add_score_value * 10 + digit
        self.input_state = self.UPDATE_ENTERING_SCORE
    
    def undo_input_digit(self):
        """Remove last digit from add score input."""
        self.add_score_value = self.add_score_value // 10
    
    def reset_input(self):
        """Reset the add score input."""
        self.add_score_value = 0
        self.input_state = self.START_ENTERING_SCORE
    
    def score_needed_by_turn(self, current_score, played_turns, target_score, target_turns):
        """Calculate score needed in target_turns to achieve target_score."""
        i = 0
        while (current_score + i) * 100 < (100 * target_score * (played_turns + target_turns)):
            i += 1
        return i
    
    def show_needed_for_perc(self, score, played_turns, target, num_turns=10):
        """Show needed scores for a specific percentage target."""
        result = []
        for i in range(num_turns):
            needed_score = self.score_needed_by_turn(score, played_turns, target, i + 1)
            needed_avg_per_turn = needed_score / (i + 1)
            result.append({
                'target': target,
                'turns': i + 1,
                'needed_score': needed_score,
                'needed_avg_per_turn': needed_avg_per_turn
            })
        return result
    
    def show_needed(self, current_score, played_turns, target_score, target_step, num_turns=10):
        """Show needed scores for multiple target percentages."""
        result = []
        target_scores = [target_score + target_step * i for i in range(3)]
        for target in target_scores:
            result.append(self.show_needed_for_perc(current_score, played_turns, target, num_turns))
        return result
    
    def calc_expected_games(self, num_games, targ_moyenne=None):
        """Calculate expected moyenne needed over num_games to reach target."""
        if not targ_moyenne:
            targ_moyenne = self.get_avg_moyenne()
        if len(self.moyennes_list) < 20:
            return 0.0
        
        result = (20.0 * targ_moyenne - sum(self.moyennes_list[-(20 - num_games):])) / num_games
        return max(0.0, result)


class CaromApp(MDApp):
    NUM_RESULT_COLS = 5
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.model = CaromModel()
        
    def build(self):
        screen = Screen()
        self.theme_cls.theme_style = "Dark"
        
        # Create tabs
        tabs = MDTabs()
        screen.add_widget(tabs)
        
        # Create first tab (game)
        game_tab = Tab(title="game")
        tabs.add_widget(game_tab)
        
        # Create second tab (overall)
        overall_tab = Tab(title="overall")
        tabs.add_widget(overall_tab)
        
        # Move existing content to game tab
        general_layout = MDBoxLayout(orientation='vertical')
        game_tab.add_widget(general_layout)
        input_layout = MDBoxLayout(orientation='horizontal')
        general_layout.add_widget(input_layout)
        self.result_layout = GridLayout(cols=self.NUM_RESULT_COLS+1, rows=4)
        general_layout.add_widget(self.result_layout)

        input_general_layout = GridLayout(cols=2, rows=4, padding=10)
        input_layout.add_widget(input_general_layout)
        input_score_layout = MDBoxLayout(orientation='vertical')
        input_layout.add_widget(input_score_layout)
        
        
        ### General fields

        self.score_input = MDTextField(
            hint_text="Score",
            pos_hint={"center_x": 0.5, "center_y": 0.7},
            size_hint_x=None,
            width=200,
            text=str(self.model.current_score)
        )
        self.score_input.bind(on_text_validate=self.on_score_changed)
        input_general_layout.add_widget(self.score_input)
        
        self.turns_input = MDTextField(
            hint_text="Turns",
            pos_hint={"center_x": 0.5, "center_y": 0.6},
            size_hint_x=None,
            width=200,
            text=str(self.model.played_turns)
        )
        self.turns_input.bind(on_text_validate=self.on_turns_changed)
        input_general_layout.add_widget(self.turns_input)
        
        self.target_input = MDTextField(
            hint_text="Target Moyenne",
            pos_hint={"center_x": 0.5, "center_y": 0.5},
            size_hint_x=None,
            width=200,
            text=str(self.model.target)
        )
        self.target_input.bind(on_text_validate=self.on_target_changed)
        input_general_layout.add_widget(self.target_input)

        self.target_step_input = MDTextField(
            hint_text="Step",
            pos_hint={"center_x": 0.5, "center_y": 0.5},
            size_hint_x=None,
            width=200,
            text=str(self.model.target_step)
        )
        self.target_step_input.bind(on_text_validate=self.on_target_step_changed)
        input_general_layout.add_widget(self.target_step_input)
        
        self.current_moyenne_label = MDTextField(
            hint_text="Moyenne",
            text="0.0",    
            disabled=True
        )
        input_general_layout.add_widget(self.current_moyenne_label)
        
        self.num_zeros_label = MDTextField(
            hint_text="0s",
            text="0", 
            disabled=True
        )
        input_general_layout.add_widget(self.num_zeros_label)

        self.reset_game_button = MDRectangleFlatButton(
            text="Reset",
            pos_hint={"center_x": 0.5, "center_y": 0.3},
            on_release=self.reset_game
        )
        input_general_layout.add_widget(self.reset_game_button)

        self.end_game_button = MDRectangleFlatButton(
            text="End",
            pos_hint={"center_x": 0.5, "center_y": 0.3},
            on_release=self.end_game
        )
        input_general_layout.add_widget(self.end_game_button)

	

        ### Score input fields

        num_pad_layout = GridLayout(cols=3, rows=4,size_hint_x=None, pos_hint={"center_x": 0.25})
        input_score_layout.add_widget(num_pad_layout)

        add_score_layout = MDBoxLayout(orientation='horizontal')
        input_score_layout.add_widget(add_score_layout)
        
        summary_score_layout = MDBoxLayout(orientation='horizontal')
        input_score_layout.add_widget(summary_score_layout)
        
        ### Input score fields

        self.score_1_button = MDRectangleFlatButton(
            text="1",
            pos_hint={"center_x": 0.5, "center_y": 0.3},
            on_release=lambda x: self.update_score_input(1)
        )
        num_pad_layout.add_widget(self.score_1_button)

        self.score_2_button = MDRectangleFlatButton(
            text="2",
            pos_hint={"center_x": 0.5, "center_y": 0.3},
            on_release=lambda x: self.update_score_input(2)
        )
        num_pad_layout.add_widget(self.score_2_button)

        self.score_3_button = MDRectangleFlatButton(
            text="3",
            pos_hint={"center_x": 0.5, "center_y": 0.3},
            on_release=lambda x: self.update_score_input(3)
        )
        num_pad_layout.add_widget(self.score_3_button)

        self.score_4_button = MDRectangleFlatButton(
            text="4",
            pos_hint={"center_x": 0.5, "center_y": 0.3},
            on_release=lambda x: self.update_score_input(4)
        )
        num_pad_layout.add_widget(self.score_4_button)

        self.score_5_button = MDRectangleFlatButton(
            text="5",
            pos_hint={"center_x": 0.5, "center_y": 0.3},
            on_release=lambda x: self.update_score_input(5)
        )
        num_pad_layout.add_widget(self.score_5_button)

        self.score_6_button = MDRectangleFlatButton(
            text="6",
            pos_hint={"center_x": 0.5, "center_y": 0.3},
            on_release=lambda x: self.update_score_input(6)
        )
        num_pad_layout.add_widget(self.score_6_button)

        self.score_7_button = MDRectangleFlatButton(
            text="7",
            pos_hint={"center_x": 0.5, "center_y": 0.3},
            on_release=lambda x: self.update_score_input(7)
        )
        num_pad_layout.add_widget(self.score_7_button)

        self.score_8_button = MDRectangleFlatButton(
            text="8",
            pos_hint={"center_x": 0.5, "center_y": 0.3},
            on_release=lambda x: self.update_score_input(8)
        )
        num_pad_layout.add_widget(self.score_8_button)

        self.score_9_button = MDRectangleFlatButton(
            text="9",
            pos_hint={"center_x": 0.5, "center_y": 0.3},
            on_release=lambda x: self.update_score_input(9)
        )
        num_pad_layout.add_widget(self.score_9_button)

        self.score_reset_button = MDRectangleFlatButton(
            text="x",
            pos_hint={"center_x": 0.5, "center_y": 0.3},
            on_release=self.reset_input_score
        )
        num_pad_layout.add_widget(self.score_reset_button)

        self.score_0_button = MDRectangleFlatButton(
            text="0",
            pos_hint={"center_x": 0.5, "center_y": 0.3},
            on_release=lambda x: self.update_score_input(0)
        )
        num_pad_layout.add_widget(self.score_0_button)

        self.score_undo_button = MDRectangleFlatButton(
            text="<",
            pos_hint={"center_x": 0.5, "center_y": 0.3},
            on_release=self.undo_score_input
        )
        num_pad_layout.add_widget(self.score_undo_button)

        ### Add score fields
        add_score_input_layout = AnchorLayout(anchor_x='right')
        self.add_score_input = MDTextField(
            hint_text="Add",
            pos_hint={"center_x": 0.25},
            size_hint_x=None,
            width=200,
            text=str(self.model.add_score_value)
        )
        add_score_input_layout.add_widget(self.add_score_input)
        add_score_layout.add_widget(add_score_input_layout)
        
        add_score_button_layout = AnchorLayout(anchor_x='left')
        self.add_score_button = MDRectangleFlatButton(
            text="+",
            pos_hint={"center_x": 0.5, "center_y": 0.3},
            on_release=self.add_score
        )
        add_score_button_layout.add_widget(self.add_score_button)
        add_score_layout.add_widget(add_score_button_layout)
        
        ### Result 
        
        column_headers = ["Target\\Turns"] + [str(i+1) for i in range(self.NUM_RESULT_COLS)]
        for header in column_headers:
            label = MDLabel(
                text=header,
                halign="center"
            )
            self.result_layout.add_widget(label)
            
        # Generate 3 rows for target scores 90, 100, 110, creating an instance variable for each entry with 
        target = self.model.target
        step = self.model.target_step
        for i in range(3):
            target_score = float(target) + float(i)*step
            target_label= f'target_{i}'
            # In the provided code snippet, `vars()[target_label]` is used to dynamically create
            # instance variables based on the value of `target_label`.
            setattr(self, target_label, MDLabel(
                        text=str(target_score),
                        halign="center"
                    )
            )
            self.result_layout.add_widget(getattr(self, target_label))
            for j in range(self.NUM_RESULT_COLS):
                target_turn_label = f'target_turn_{i}_{j}'
                setattr(self, target_turn_label, MDLabel(
                        text="0",
                        halign="center"
                )
                )
                self.result_layout.add_widget(getattr(self, target_turn_label))
        
        # Add content to overall tab
        overall_layout = MDBoxLayout(orientation='vertical', padding=10, spacing=10)
        overall_tab.add_widget(overall_layout)
        
        # Input section (positioned above the list)
        input_section = MDBoxLayout(
            orientation='horizontal',
            size_hint_y=None,
            height=60,
            spacing=10,
            padding=10
        )
        overall_layout.add_widget(input_section)
        
        self.game_score_input = MDTextField(
            hint_text="Enter game score",
            size_hint_x=0.7
        )
        input_section.add_widget(self.game_score_input)
        
        add_moyenne_button = MDRectangleFlatButton(
            text="Add",
            size_hint_x=0.3,
            on_release=self.add_moyenne
        )
        input_section.add_widget(add_moyenne_button)
        
        # Statistics section (between input and list)
        stats_section = MDBoxLayout(
            orientation='horizontal',
            size_hint_y=None,
            height=60,
            spacing=10,
            padding=10
        )
        overall_layout.add_widget(stats_section)
        
        self.avg_moyenne_field = MDTextField(
            hint_text="Avg Moyenne",
            text="0.00",
            disabled=True,
            size_hint_x=0.5
        )
        stats_section.add_widget(self.avg_moyenne_field)
        
        self.score_target_field = MDTextField(
            hint_text="Score Target",
            text="0.00",
            disabled=True,
            size_hint_x=0.5
        )
        stats_section.add_widget(self.score_target_field)
        
        # Target projections section
        projections_section = MDBoxLayout(
            orientation='vertical',
            size_hint_y=None,
            height=180,
            spacing=5,
            padding=10
        )
        overall_layout.add_widget(projections_section)
        
        self.projection_0_field = MDTextField(
            hint_text="Target 0",
            text="",
            disabled=True
        )
        projections_section.add_widget(self.projection_0_field)
        
        self.projection_1_field = MDTextField(
            hint_text="Target 1",
            text="",
            disabled=True
        )
        projections_section.add_widget(self.projection_1_field)
        
        self.projection_2_field = MDTextField(
            hint_text="Target 2",
            text="",
            disabled=True
        )
        projections_section.add_widget(self.projection_2_field)
        
        # Create scrollable content for expansion panel
        scroll_content = MDScrollView(size_hint_y=None, height=300)
        
        self.moyennes_display_layout = MDBoxLayout(
            orientation='vertical',
            spacing=5,
            adaptive_height=True,
            padding=10
        )
        scroll_content.add_widget(self.moyennes_display_layout)
        
        # Populate the list
        self.update_moyennes_display()
        
        # Create collapsible expansion panel
        self.moyennes_panel = MDExpansionPanel(
            icon="chevron-down",
            content=scroll_content,
            panel_cls=MDExpansionPanelOneLine(
                text="Previous Game Moyennes (20)"
            )
        )
        overall_layout.add_widget(self.moyennes_panel)
        
        self.calculate_needed_scores(None)
        return screen
    
    # View update methods
    def on_score_changed(self, instance):
        """Update model when score input changes."""
        try:
            self.model.current_score = int(self.score_input.text or 0)
        except ValueError:
            self.model.current_score = 0
        self.update_view()
    
    def on_turns_changed(self, instance):
        """Update model when turns input changes."""
        try:
            self.model.played_turns = int(self.turns_input.text or 0)
        except ValueError:
            self.model.played_turns = 0
        self.update_view()
    
    def on_target_changed(self, instance):
        """Update model when target input changes."""
        try:
            self.model.target = float(self.target_input.text or self.model.DEFAULT_TARGET)
        except ValueError:
            self.model.target = self.model.DEFAULT_TARGET
        self.update_view()
        self.update_moyennes_display()
    
    def on_target_step_changed(self, instance):
        """Update model when target step input changes."""
        try:
            self.model.target_step = float(self.target_step_input.text or self.model.DEFAULT_TARGET_STEP)
        except ValueError:
            self.model.target_step = self.model.DEFAULT_TARGET_STEP
        self.update_view()
        self.update_moyennes_display()
    
    def update_view(self):
        """Update all view elements from model state."""
        self.calculate_needed_scores(None)
        self.update_summary_scores()
        
    def update_target_scores(self, instance):
        self.on_target_changed(instance)
        
    def calculate_needed_scores(self, instance):
        results = self.model.show_needed(
            self.model.current_score,
            self.model.played_turns,
            self.model.target,
            self.model.target_step
        )
        
        
        for i, res in enumerate(results):
            target = res[0]['target']
            getattr(self, f'target_{i}').text = str(target)
            for j, r in enumerate(res):
                if j < self.NUM_RESULT_COLS:
                    target_turn_label = f'target_turn_{i}_{j}'
                    getattr(self, target_turn_label).text = f"{r['needed_score']}"
    
    def add_score(self, instance):
        """Add score from input to game."""
        try:
            add_score = int(self.add_score_input.text)
            self.model.add_to_score(add_score)
            self.model.reset_input()
            self.sync_view_from_model()
        except ValueError:
            pass

    def reset_game(self, instance):
        """Reset the current game."""
        self.model.reset_game()
        self.sync_view_from_model()

    def end_game(self, instance):
        """End the current game and add moyenne to list."""
        self.model.end_game()
        self.sync_view_from_model()
        self.update_moyennes_display()

    def reset_input_score(self, instance):
        """Reset the add score input."""
        self.model.reset_input()
        self.model.num_zero_scores = 0
        self.sync_view_from_model()

    def update_score_input(self, num):
        """Update the score input with a digit."""
        self.model.update_input_digit(num)
        self.add_score_input.text = str(self.model.add_score_value)

    def undo_score_input(self, instance):
        """Undo last digit in score input."""
        self.model.undo_input_digit()
        self.add_score_input.text = str(self.model.add_score_value)
    
    def sync_view_from_model(self):
        """Synchronize all view fields from model state."""
        self.score_input.text = str(self.model.current_score)
        self.turns_input.text = str(self.model.played_turns)
        self.add_score_input.text = str(self.model.add_score_value)
        self.current_moyenne_label.text = f"{self.model.get_current_moyenne():.2f}"
        self.num_zeros_label.text = str(self.model.num_zero_scores)
        self.calculate_needed_scores(None)
            
    def update_summary_scores(self):
        """Update the summary score displays."""
        self.current_moyenne_label.text = f"{self.model.get_current_moyenne():.2f}"
        self.num_zeros_label.text = f"{self.model.num_zero_scores}"
    
    def update_moyennes_display(self):
        """Update the display of moyennes list."""
        self.moyennes_display_layout.clear_widgets()
        for i, moyenne in enumerate(self.model.moyennes_list, 1):
            label = MDLabel(
                text=f"{i}. {moyenne:.2f}",
                halign="left",
                size_hint_y=None,
                height=30
            )
            self.moyennes_display_layout.add_widget(label)
        
        # Update statistics fields
        avg = self.model.get_avg_moyenne()
        target = self.model.get_score_target()
        self.avg_moyenne_field.text = f"{avg:.2f}"
        self.score_target_field.text = f"{int(target)}"
        
        # Update projection fields with stepped target values
        base_target = self.model.target
        step = self.model.target_step
        
        for i in range(3):
            stepped_target = base_target + (i * step)
            expected_games = self.model.calc_expected_games(1, float(stepped_target))
            projection_field = getattr(self, f'projection_{i}_field')
            projection_field.hint_text = f"Target {stepped_target}:"
            projection_field.text = f"{expected_games:.2f}"
    
    def add_moyenne(self, instance):
        """Add a new moyenne using FIFO (removes oldest, adds newest)."""
        try:
            new_moyenne = float(self.game_score_input.text)
            self.model.add_moyenne_to_list(new_moyenne)
            self.update_moyennes_display()
            self.game_score_input.text = ""
        except ValueError:
            pass  # Invalid input, do nothing
	
if __name__ == '__main__':
	CaromApp().run()